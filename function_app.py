import azure.functions as func
import logging
import json
from azure.storage.blob import BlobServiceClient
from azure.data.tables import TableServiceClient, TableClient
import os
import tempfile
import PyPDF2
import docx
import uuid
import pandas as pd
import openpyxl
import requests
import time
from io import BytesIO
from datetime import datetime

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="ProcessResume", methods=["POST"])
def process_resume(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('ProcessResume function processed a request.')
    
    try:
        # ファイルの取得
        file_data = req.get_body()
        if not file_data:
            return func.HttpResponse(
                json.dumps({"error": "ファイルが見つかりません"}),
                mimetype="application/json",
                status_code=400
            )

        # Content-Typeの確認
        content_type = req.headers.get('Content-Type', '')
        logging.info(f"Content-Type: {content_type}")

        # 一時ファイルとして保存
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(file_data)
            temp_file_path = temp_file.name

        # テキスト抽出
        extracted_text = extract_text_from_file(temp_file_path, content_type)
        
        # 一時ファイルの削除
        os.unlink(temp_file_path)

        return func.HttpResponse(
            json.dumps({"text": extracted_text}, ensure_ascii=False),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"エラー発生: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

@app.route(route="AnalyzeWithGPT", methods=["POST"])
def analyze_with_gpt(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('AnalyzeWithGPT function processed a request.')
    
    try:
        req_body = req.get_json()
        resume_text = req_body.get('resumeText')
        jd_data = req_body.get('jdData', {})

        if not resume_text:
            return func.HttpResponse(
                json.dumps({"error": "レジュメテキストが必要です"}),
                mimetype="application/json",
                status_code=400
            )

        analysis_result = analyze_resume(resume_text, jd_data)
        
        return func.HttpResponse(
            json.dumps(analysis_result, ensure_ascii=False),
            mimetype="application/json",
            status_code=200
        )

    except Exception as e:
        logging.error(f"エラー発生: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

def extract_text_from_file(file_path: str, content_type: str) -> str:
    """ファイルからテキストを抽出する"""
    try:
        if 'pdf' in content_type.lower():
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                return text

        elif 'word' in content_type.lower() or 'docx' in content_type.lower():
            doc = docx.Document(file_path)
            return "\n".join([paragraph.text for paragraph in doc.paragraphs])

        elif 'excel' in content_type.lower() or 'xlsx' in content_type.lower():
            wb = openpyxl.load_workbook(file_path)
            text = ""
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                for row in ws.iter_rows():
                    text += " ".join([str(cell.value) if cell.value else "" for cell in row]) + "\n"
            return text

        else:
            raise ValueError(f"未対応のファイル形式です: {content_type}")

    except Exception as e:
        logging.error(f"テキスト抽出エラー: {str(e)}")
        raise

def analyze_resume(resume_text: str, jd_data: dict) -> dict:
    """GPT-4を使用してレジュメを分析する"""
    try:
        api_key = os.environ.get("OPENAI_HERE")
        if not api_key:
            raise ValueError("OpenAI APIキーが設定されていません")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # プロンプトの作成
        system_message = """
あなたは採用担当者のアシスタントです。
提供されたレジュメと職務要件を分析し、以下の項目について評価してください：
1. 職務要件との適合度（100点満点）
2. 候補者への面接で確認すべき質問（5つ）
3. 不足しているスキルや経験（3つ）
4. 主な職歴の要約
5. 採用担当者へのアドバイス

回答は必ずJSON形式で返してください。
"""

        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": f"レジュメ:\n{resume_text[:8000]}\n\n職務要件:\n{json.dumps(jd_data, ensure_ascii=False)}"}
        ]

        payload = {
            "model": "gpt-4",
            "messages": messages,
            "temperature": 0.2
        }

        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=60
        )

        if response.status_code != 200:
            raise Exception(f"OpenAI APIエラー: {response.status_code}")

        result = response.json()
        return json.loads(result['choices'][0]['message']['content'])

    except json.JSONDecodeError as e:
        logging.error(f"JSON解析エラー: {str(e)}")
        raise Exception("GPTからの応答の解析に失敗しました")
    except requests.exceptions.RequestException as e:
        logging.error(f"API通信エラー: {str(e)}")
        raise Exception("OpenAI APIとの通信に失敗しました")
    except Exception as e:
        logging.error(f"予期せぬエラー: {str(e)}")
        raise

def serialize_entity(entity):
    """エンティティをJSONシリアライズ可能な形式に変換"""
    if hasattr(entity, 'dict'):
        return entity.dict
    else:
        result = {}
        for key, value in entity.items():
            if key in ['PartitionKey', 'RowKey', 'Timestamp', 'etag']:
                continue
            result[key] = value
        return result

@app.route(route="ManageJD", methods=["POST", "GET"])
def ManageJD(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('JD管理関数が呼び出されました')
    
    # CORS対応ヘッダー
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
    
    # OPTIONSリクエストの処理
    if req.method == "OPTIONS":
        return func.HttpResponse(
            status_code=200,
            headers=headers
        )
        
    try:
        if req.method == "GET":
            try:
                category = req.params.get('category')
                jd_id = req.params.get('id')
                
                query = "PartitionKey eq 'jd'"
                if jd_id:
                    query = f"PartitionKey eq 'jd' and RowKey eq '{jd_id}'"
                elif category:
                    query += f" and category eq '{category}'"
                
                table_client = get_table_client("jdList")
                jd_list = list(table_client.query_entities(query))
                
                result = []
                for entity in jd_list:
                    try:
                        jd_data = json.loads(entity.get('data', '{}'))
                    except:
                        jd_data = {}
                    
                    result.append({
                        'id': entity['RowKey'],
                        'title': entity.get('title', ''),
                        'category': entity.get('category', ''),
                        'createdAt': entity.get('createdAt', ''),
                        'updatedAt': entity.get('updatedAt', ''),
                        'data': jd_data
                    })
                
                return func.HttpResponse(
                    json.dumps(result),
                    mimetype="application/json",
                    headers=headers,
                    status_code=200
                )
            except Exception as e:
                logging.error(f"JD一覧取得エラー: {str(e)}")
                return func.HttpResponse(
                    json.dumps({"error": str(e)}),
                    mimetype="application/json",
                    headers=headers,
                    status_code=500
                )
        
        elif req.method == "POST":
            try:
                req_body = req.get_json()
            except ValueError as e:
                logging.error(f"JSONパースエラー: {str(e)}")
                body_text = req.get_body().decode('utf-8', errors='replace')
                logging.error(f"受信したリクエストボディ: {body_text[:1000]}")
                return func.HttpResponse(
                    json.dumps({"error": "Invalid JSON data"}),
                    mimetype="application/json",
                    headers=headers,
                    status_code=400
                )
            
            try:
                jd_id = req_body.get('id')
                is_delete = req_body.get('delete', False)
                
                if is_delete and jd_id:
                    table_client = get_table_client("jdList")
                    table_client.delete_entity(partition_key='jd', row_key=jd_id)
                    return func.HttpResponse(
                        json.dumps({"status": "success", "message": "JDが削除されました"}),
                        mimetype="application/json",
                        headers=headers,
                        status_code=200
                    )
                
                jd_data = req_body.get('data', {})
                
                if not jd_id:
                    jd_id = str(uuid.uuid4())
                
                current_time = datetime.utcnow().isoformat()
                
                table_client = get_table_client("jdList")
                entity = {
                    'PartitionKey': 'jd',
                    'RowKey': jd_id,
                    'title': jd_data.get('position', ''),
                    'category': jd_data.get('category', ''),
                    'updatedAt': current_time,
                    'data': json.dumps(jd_data)
                }
                
                try:
                    existing = table_client.get_entity('jd', jd_id)
                    entity['createdAt'] = existing.get('createdAt', current_time)
                except:
                    entity['createdAt'] = current_time
                
                table_client.upsert_entity(entity)
                
                return func.HttpResponse(
                    json.dumps({"id": jd_id, "status": "success"}),
                    mimetype="application/json",
                    headers=headers,
                    status_code=200
                )
            except Exception as e:
                logging.error(f"JD登録/更新エラー: {str(e)}")
                return func.HttpResponse(
                    json.dumps({"error": str(e)}),
                    mimetype="application/json",
                    headers=headers,
                    status_code=500
                )
    
    except Exception as e:
        logging.error(f"予期せぬエラー: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            headers=headers,
            status_code=500
        )

@app.route(route="ImportJDFromExcel", methods=["POST", "OPTIONS"])
def ImportJDFromExcel(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Excel JDインポート関数が呼び出されました')
    
    # CORS対応ヘッダー
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
    
    # OPTIONSリクエストの処理
    if req.method == "OPTIONS":
        return func.HttpResponse(
            status_code=200,
            headers=headers
        )
        
    try:
        file_data = req.get_body()
        
        jd_list = parse_jd_excel(file_data)
        
        results = []
        table_client = get_table_client("jdList")
        
        current_time = datetime.utcnow().isoformat()
        
        for jd in jd_list:
            jd_id = str(uuid.uuid4())
            
            entity = {
                'PartitionKey': 'jd',
                'RowKey': jd_id,
                'title': jd.get('position', ''),
                'category': jd.get('category', ''),
                'createdAt': current_time,
                'updatedAt': current_time,
                'data': json.dumps(jd)
            }
            
            table_client.upsert_entity(entity)
            results.append({
                "id": jd_id, 
                "title": jd.get('position', '')
            })
        
        return func.HttpResponse(
            json.dumps({
                "status": "success", 
                "imported": len(results), 
                "items": results
            }),
            mimetype="application/json",
            headers=headers,
            status_code=200
        )
    except Exception as e:
        logging.error(f"