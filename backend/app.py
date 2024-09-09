import logging
import os
from datetime import timedelta
import uuid
import json
import time

from dotenv import load_dotenv
from flask import Flask, request, jsonify, session, send_from_directory, Response, stream_with_context
from flask_cors import CORS, cross_origin
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, decode_token
import jwt
from flask_socketio import SocketIO, emit
from langsmith import traceable, trace
from supabase import create_client, Client

load_dotenv()

from config import Config
from llm_interaction import LLMInteraction

# Set environment variables
os.environ['LANGCHAIN_API_KEY'] = os.getenv('LANGCHAIN_API_KEY')
os.environ['LANGCHAIN_PROJECT'] = os.getenv('LANGCHAIN_PROJECT')
os.environ['LANGCHAIN_TRACING_V2'] = os.getenv('LANGCHAIN_TRACING_V2')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

app.secret_key = os.environ.get('FLASK_SECRET_KEY') or os.urandom(24)

CORS(app,
     resources={r"/api/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}},
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "PUT", "OPTIONS", "DELETE"],
     expose_headers=["Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"])
app.config.from_object(Config)

# Initialize Supabase client
supabase: Client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)

# Import resources
from resources.agents import agents_bp
from resources.tools import tools_bp
from resources.tasks import tasks_bp
from resources.auth import auth_bp
from resources.conversations import conversations_bp

app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(agents_bp, url_prefix='/agents')
app.register_blueprint(tools_bp, url_prefix='/tools')
app.register_blueprint(tasks_bp, url_prefix='/tasks')
app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(conversations_bp, url_prefix='/api/conversations')

# Initialize LLMInteraction
llm_interaction = LLMInteraction()

@app.route('/llm', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def llm_interaction_route():
    if request.method == 'OPTIONS':
        return '', 200
    
    user_id = get_jwt_identity()
    data = request.get_json()
    conversation_history = data['prompt']
    conversation_id = data['conversation_id']

    # Query Supabase to get the user's name
    user = supabase.table('user').select('name').eq('id', user_id).execute().data
    user_name = user[0]['name'] if user else "Unknown User"

    # Generate a consistent UUID for the conversation
    conversation_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"conversation:{conversation_id}"))

    # Use the LLMInteraction directly
    with trace("llm_interaction_route",
               run_type="chain",
               tags=[str(user_id), user_name],
               metadata={"conversation_id": conversation_uuid}
               ) as run:
        result = llm_interaction.get_response(conversation_history)
        run.end(outputs={"result": result})

    return jsonify(result), 200

@app.route('/llm_stream', methods=['POST'])
@cross_origin(supports_credentials=True)
@jwt_required()
def llm_interaction_stream():
    user_id = get_jwt_identity()
    data = request.get_json()
    conversation_history = data['prompt']
    conversation_id = int(data['conversation_id'])

    user = supabase.table('user').select('name').eq('id', user_id).execute().data
    user_name = user[0]['name'] if user else "Unknown User"
    conversation_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"conversation:{conversation_id}"))

    def generate():
        with trace("llm_interaction_stream",
                   run_type="chain",
                   tags=[str(user_id), user_name],
                   metadata={"conversation_id": conversation_uuid}
                   ) as run:
            for chunk in llm_interaction.get_response_stream(conversation_history):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: {\"type\": \"end\"}\n\n"
            run.end()

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

def empty_stream():
    while True:
        yield ': keepalive\n\n'
        time.sleep(15)

def stream_error(error_message):
    yield f"data: {json.dumps({'type': 'error', 'data': error_message})}\n\n"
    yield "data: {\"type\": \"end\"}\n\n"

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('send_message')
def handle_send_message(data):
    message = data['message']
    user_id = session.get('user_id')
    if not user_id:
        emit('receive_message', {'error': 'User not authenticated'})
        return

    # Here you would typically save the message to Supabase and process it
    # For now, we'll just echo the message back
    emit('receive_message', {'message': message, 'sender': 'user'})
    emit('receive_message', {'message': 'AI response', 'sender': 'ai'})

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run()