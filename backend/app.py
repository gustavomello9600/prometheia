import logging
import os
from datetime import timedelta
import uuid
import json
import time

from dotenv import load_dotenv
from flask import (Flask, request, jsonify, session,
                   send_from_directory, Response, stream_with_context)
from flask_cors import CORS, cross_origin
from flask_jwt_extended import (JWTManager, jwt_required,
                                  get_jwt_identity, decode_token)
import jwt
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from langsmith import traceable, trace

from config import Config
from llm_interaction import LLMInteraction

# Load environment variables from .env file
load_dotenv()

# Set environment variables
os.environ['LANGCHAIN_API_KEY'] = os.getenv('LANGCHAIN_API_KEY')
os.environ['LANGCHAIN_PROJECT'] = os.getenv('LANGCHAIN_PROJECT')
os.environ['LANGCHAIN_TRACING_V2'] = os.getenv('LANGCHAIN_TRACING_V2')

logging.basicConfig(level=logging.DEBUG)
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
db = SQLAlchemy(app)
migrate = Migrate(app, db)

# Import models and resources
from models import User, Agent, Tool, Task, Conversation
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
    conversation_id = data['conversation_id']  # Get conversation_id from the request

    # Query the database to get the user's name
    user = User.query.get(user_id)
    user_name = user.name if user else "Unknown User"

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

# Add this new route for streaming responses
@app.route('/llm_stream', methods=['GET', 'POST'])
@cross_origin(supports_credentials=True)
def llm_interaction_stream():
    if request.method == 'POST':
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "No authorization header"}), 401
        
        try:
            access_token = auth_header.split(' ')[1]
            decoded_token = decode_token(access_token)
            user_id = decoded_token['sub']
        except jwt.exceptions.PyJWTError as e:
            return jsonify({"error": f"Invalid token: {str(e)}"}), 401

        data = request.get_json()
        conversation_history = data['prompt']
        conversation_id = int(data['conversation_id'])

        # Store the conversation data in the session or database
        session['conversation_data'] = {
            'user_id': user_id,
            'conversation_history': conversation_history,
            'conversation_id': conversation_id
        }

        return jsonify({"message": "Conversation initialized", "conversation_id": conversation_id}), 200

    elif request.method == 'GET':
        conversation_id = int(request.args.get('conversation_id'))
        if not conversation_id:
            return jsonify({"error": "No conversation_id provided"}), 400

        # Retrieve the conversation data
        conversation_data = session.get('conversation_data')
        print(f"conversation_data = {conversation_data}")
        print(f"conversation_id from session = {conversation_data['conversation_id']} of type {type(conversation_data['conversation_id'])}")
        print(f"conversation_id from request = {conversation_id} of type {type(conversation_id)}")
        if conversation_data['conversation_id'] != conversation_id:
            return jsonify({f"error": "Invalid or expired conversation. conversation_data = {conversation_data}"}), 400

        user_id = conversation_data['user_id']
        conversation_history = conversation_data['conversation_history']

        def generate():
            user = User.query.get(user_id)
            user_name = user.name if user else "Unknown User"
            conversation_uuid = str(uuid.uuid5(uuid.NAMESPACE_URL, f"conversation:{conversation_id}"))

            with trace("llm_interaction_stream",
                       run_type="chain",
                       tags=[str(user_id), user_name],
                       metadata={"conversation_id": conversation_uuid}
                       ) as run:
                for chunk in llm_interaction.get_response_stream(conversation_history):
                    print(f"Sending chunk: {chunk}")
                    yield f"data: {json.dumps(chunk)}\n\n"
                print("Stream ended")
                yield "data: {\"type\": \"end\"}\n\n"
                run.end()

        return Response(stream_with_context(generate()), mimetype='text/event-stream')

    else:
        return jsonify({"error": "Method not allowed"}), 405

def empty_stream():
    while True:
        yield ': keepalive\n\n'
        time.sleep(15)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Add this route for handling chat messages
@socketio.on('send_message')
def handle_send_message(data):
    message = data['message']
    user_id = session.get('user_id')
    if not user_id:
        emit('receive_message', {'error': 'User not authenticated'})
        return

    # Here you would typically save the message to the database and process it
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
    socketio.run(app, debug=True)