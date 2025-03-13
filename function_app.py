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
from io import BytesIO
from datetime import datetime

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

@app.route(route="ProcessResume", methods=["POST"])
def ProcessResume(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('レジュメアップロード処理が開始されました')
    
    try:
        # Blobストレージの接続設定
        connection_string = os.environ["StorageConnectionString"]
        container_name = "resumes"
        
        # POSTリクエストからファイルを取得
        file_data = req.get_body()
        content_type = req.headers.get('content-type', '')
        
        if not file_data:
            return func.HttpResponse(
                json.dumps({"error": "ファイルが見つかりません"}),
                mimetype="application/json",
                status_code=400
            )
        
        # ファイル形式を判定
        file_extension = ""
        content_type = req.headers.get('content-type', '').lower()

        if 'pdf' in content_type:
            file_extension = ".pdf"
        elif ('spreadsheetml' in content_type or 'excel' in content_type or
              'sheet' in content_type or 'xlsx' in content_type or 'xls' in content_type):
            if 'xlsx' in content_type:
                file_extension = ".xlsx"
            else:
                file_extension = ".xls"
        elif ('wordprocessingml' in content_type or 'document' in content_type or
              'docx' in content_type or 'doc' in content_type):
            if 'docx' in content_type:
                file_extension = ".docx"
            else:
                file_extension = ".doc"
        else:
            filename = req.headers.get('x-ms-file-name', '')
            if filename.lower().endswith('.pdf'):
                file_extension = ".pdf"
            elif filename.lower().endswith('.docx'):
                file_extension = ".docx"
            elif filename.lower().endswith('.xlsx'):
                file_extension = ".xlsx"
            elif filename.lower().endswith('.xls'):
                file_extension = ".xls"
            else:
                return func.HttpResponse(
                    json.dumps({"error": f"サポートされていないファイル形式です: {content_type}"}),
                    mimetype="application/json",
                    status_code=400
                )
        
        # 一意のファイル名を生成
        file_id = str(uuid.uuid4())
        file_name = file_id + file_extension
        
        # Blobストレージに保存
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
        container_client = blob_service_client.get_container_client(container_name)
        
        if not container_client.exists():
            container_client.create_container()
        
        blob_client = container_client.get_blob_client(file_name)
        blob_client.upload_blob(file_data, overwrite=True)
        
        # テキスト抽出処理
        text_content = extract_text(file_data, file_extension)
        
        return func.HttpResponse(
            json.dumps({
                "fileId": file_id,
                "fileName": file_name,
                "textContent": text_content,
                "status": "success"
            }),
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

def extract_text(file_data, file_extension):
    """ファイルからテキストを抽出する関数"""
    try:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        temp_file.write(file_data)
        temp_file.close()
        
        text_content = ""
        
        if file_extension == ".pdf":
            with open(temp_file.name, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page in reader.pages:
                    text_content += (page.extract_text() or "") + "\n"
        
        elif file_extension == ".docx":
            doc = docx.Document(temp_file.name)
            for para in doc.paragraphs:
                text_content += para.text + "\n"
        
        elif file_extension in [".xlsx", ".xls"]:
            all_sheets_text = []
            xls = pd.ExcelFile(temp_file.name)
            for sheet_name in xls.sheet_names:
                df = pd.read_excel(temp_file.name, sheet_name=sheet_name)
                all_sheets_text.append(f"===== シート: {sheet_name} =====")
                sheet_text = df.to_string(index=False)
                all_sheets_text.append(sheet_text)
                all_sheets_text.append("\n")
            text_content = "\n".join(all_sheets_text)
            
            if file_extension == ".xlsx":
                try:
                    workbook = openpyxl.load_workbook(temp_file.name, data_only=True)
                    for sheet_name in workbook.sheetnames:
                        sheet = workbook[sheet_name]
                        for row in sheet.iter_rows():
                            for cell in row:
                                if cell.comment:
                                    text_content += f"\nコメント ({sheet_name} {cell.coordinate}): {cell.comment.text}"
                except Exception as e:
                    logging.warning(f"Excel詳細情報抽出エラー: {str(e)}")
        
        os.unlink(temp_file.name)
        return text_content
    
    except Exception as e:
        logging.error(f"テキスト抽出エラー: {str(e)}")
        raise e

@app.route(route="AnalyzeWithGPT", methods=["POST"])
def AnalyzeWithGPT(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('GPT API連携関数が呼び出されました')
    
    try:
        try:
            req_body = req.get_json()
            logging.info(f"リクエストボディ: {req_body}")
        except ValueError as e:
            logging.error(f"JSONパースエラー: {str(e)}")
            body_text = req.get_body().decode('utf-8', errors='replace')
            logging.error(f"受信したリクエストボディ: {body_text[:1000]}")
            return func.HttpResponse(
                json.dumps({"error": "HTTP request does not contain valid JSON data"}),
                mimetype="application/json",
                status_code=400
            )
        
        resume_text = req_body.get('resumeText')
        jd_data = req_body.get('jdData', {})
        
        if not resume_text:
            logging.error("レジュメテキストが提供されていません")
            return func.HttpResponse(
                json.dumps({"error": "レジュメテキストが提供されていません"}),
                mimetype="application/json",
                status_code=400
            )
        
        logging.info("GPT API呼び出し開始")
        analysis_result = call_gpt_api(resume_text, jd_data)
        logging.info("GPT API呼び出し完了")
        
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

def call_gpt_api(resume_text, jd_data):
    """GPT APIを呼び出してレジュメを分析する関数"""
    try:
        api_key = os.environ.get("OPENAI_HERE")
        if not api_key:
            logging.error("環境変数 OPENAI_HERE が設定されていません")
            return {"error": "APIキーが設定されていません"}
            
        api_url = "https://api.openai.com/v1/chat/completions"
        
        max_tokens = 12000
        if len(resume_text) > max_tokens:
            resume_text = resume_text[:max_tokens] + "...(省略)"
            
        prompt = create_analysis_prompt(resume_text, jd_data)
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-4",
            "messages": [
                {"role": "system", "content": "あなたは履歴書を分析する専門家です。正確で詳細な分析を提供してください。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 4000,
            "temperature": 0.2,
            "response_format": { "type": "json_object" }
        }
        
        logging.info("OpenAI APIリクエスト準備完了")
        logging.info(f"使用モデル: {payload['model']}")
        
        response = requests.post(api_url, headers=headers, json=payload, timeout=180)
        
        if response.status_code != 200:
            error_detail = response.text[:500] if response.text else "詳細なし"
            logging.error(f"OpenAI API応答エラー: Status={response.status_code}, Response={error_detail}")
            
            if response.status_code == 401:
                return {"error": "OpenAI APIの認証に失敗しました。APIキーを確認してください。"}
            elif response.status_code == 429:
                return {"error": "OpenAI APIのレート制限に達しました。しばらく時間をおいて再試行してください。"}
            elif response.status_code == 500:
                return {"error": "OpenAI APIでサーバーエラーが発生しました。しばらく時間をおいて再試行してください。"}
            else:
                return {"error": f"OpenAI APIエラー: {response.status_code} - {error_detail}"}
            
        result = response.json()
        analysis_text = result['choices'][0]['message']['content']
        
        try:
            json_start = analysis_text.find('{')
            json_end = analysis_text.rfind('}') + 1
            if json_start >= 0 and json_end > 0:
                json_str = analysis_text[json_start:json_end]
                analysis_data = json.loads(json_str)
            else:
                analysis_data = {"raw_analysis": analysis_text}
        except json.JSONDecodeError:
            analysis_data = {"raw_analysis": analysis_text}
        
        return analysis_data
    
    except requests.exceptions.Timeout:
        logging.error("GPT API呼び出しがタイムアウトしました")
        return {"error": "APIリクエストがタイムアウトしました。しばらく時間をおいて再試行してください。"}
    except requests.exceptions.RequestException as e:
        logging.error(f"GPT API呼び出しネットワークエラー: {str(e)}")
        return {"error": f"ネットワークエラー: {str(e)}"}
    except Exception as e:
        logging.error(f"GPT API呼び出しエラー: {str(e)}")
        return {"error": f"エラーが発生しました: {str(e)}"}

def create_analysis_prompt(resume_text, jd_data):
    """分析用のプロンプトを作成する関数"""
    jd_json = json.dumps(jd_data, ensure_ascii=False, indent=2)
    
    prompt = f"""レジュメ情報:
{resume_text}

JD情報:
{jd_json}

指示：
以下の分析を行い、JSONフォーマットで結果を返してください:

1. このレジュメのスキル・経験と、JDの要件との適合度を100点満点で評価し、その理由を説明してください。

2. この候補者に対して、選択されたポジションに関する面接質問を10個作成してください。質問は候補者の経歴に基づき、技術的能力、経験、文化的フィット、成果などを評価できるものにしてください。

3. 候補者の経歴において掘り下げるべき重要ポイントや、JDとの比較で不足していると思われるスキル・経験を3〜5点特定してください。

4. レジュメに記載された各勤務先とその期間、役職を抽出してリスト化してください。

出力形式:
必ずJSONで返答してください:
{{
    "適合度評価": {{
        "スコア": 80,
        "評価理由": "..."
    }},
    "面接質問リスト": [
        "質問1...",
        "質問2...",
        "..."
    ],
    "掘り下げポイント": [
        {{"ポイント": "...", "理由": "..."}},
        {{"ポイント": "...", "理由": "..."}},
        "..."
    ],
    "不足スキル": [
        {{"スキル": "...", "重要度": "高/中/低"}},
        {{"スキル": "...", "重要度": "高/中/低"}},
        "..."
    ],
    "勤務履歴": [
        {{"会社名": "...", "役職": "...", "期間": "..."}},
        {{"会社名": "...", "役職": "...", "期間": "..."}},
        "..."
    ]
}}
この形式に厳密に従ってください。JSONのみを出力し、追加の説明は不要です。
"""
    return prompt

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
                    status_code=200
                )
            except Exception as e:
                logging.error(f"JD一覧取得エラー: {str(e)}")
                return func.HttpResponse(
                    json.dumps({"error": str(e)}),
                    mimetype="application/json",
                    status_code=500
                )
        
        elif req.method == "POST":
            try:
                req_body = req.get_json()
            except ValueError as e:
                logging.error(f"JSONパースエラー: {str(e)}")
                return func.HttpResponse(
                    json.dumps({"error": "Invalid JSON data"}),
                    mimetype="application/json",
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
                    status_code=200
                )
            except Exception as e:
                logging.error(f"JD登録/更新エラー: {str(e)}")
                return func.HttpResponse(
                    json.dumps({"error": str(e)}),
                    mimetype="application/json",
                    status_code=500
                )
    
    except Exception as e:
        logging.error(f"予期せぬエラー: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

@app.route(route="ImportJDFromExcel", methods=["POST"])
def ImportJDFromExcel(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Excel JDインポート関数が呼び出されました')
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
            status_code=200
        )
    except Exception as e:
        logging.error(f"Excelインポートエラー: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            mimetype="application/json",
            status_code=500
        )

def parse_jd_excel(file_data):
    """Excelファイルを解析してJDリストを作成する関数"""
    try:
        excel_file = BytesIO(file_data)
        df = pd.read_excel(excel_file)
        required_columns = ['position', 'requirements', 'responsibilities']
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"必須カラム '{col}' がExcelに存在しません")
        
        jd_list = []
        for _, row in df.iterrows():
            jd = {}
            for col in df.columns:
                if pd.notna(row[col]):
                    jd[col] = row[col]
            if 'position' in jd and jd['position']:
                jd_list.append(jd)
        
        return jd_list

    except Exception as e:
        logging.error(f"Excel解析エラー: {str(e)}")
        raise e

def get_table_client(table_name):
    """Table Storageのクライアントを取得する関数"""
    try:
        connection_string = os.environ["StorageConnectionString"]
        table_service_client = TableServiceClient.from_connection_string(connection_string)
        
        try:
            table_service_client.create_table(table_name)
        except Exception as e:
            logging.info(f"テーブル作成スキップ: {str(e)}")
        
        return table_service_client.get_table_client(table_name)
    except Exception as e:
        logging.error(f"テーブルクライアント取得エラー: {str(e)}")
        raise e