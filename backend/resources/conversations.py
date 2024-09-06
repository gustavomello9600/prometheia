from flask import Blueprint, request, jsonify
from app import db
from models import Conversation, Message
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin

conversations_bp = Blueprint('conversations', __name__)

@conversations_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_conversations():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_jwt_identity()
    conversations = Conversation.query.filter_by(user_id=user_id).all()
    return jsonify([{
        'id': conv.id,
        'title': conv.title,
        'date': conv.date.isoformat()
    } for conv in conversations]), 200

@conversations_bp.route('/', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def create_conversation():
    if request.method == 'OPTIONS':
        return '', 200
    
    user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    date = datetime.now()

    new_conversation = Conversation(user_id=user_id, title=title, date=date)
    db.session.add(new_conversation)
    db.session.commit()

    return jsonify({
        'id': new_conversation.id,
        'title': new_conversation.title,
        'date': new_conversation.date.isoformat()
    }), 201

@conversations_bp.route('/<int:conversation_id>/messages', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_messages(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.get_or_404(conversation_id)
    if conversation.user_id != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    messages = Message.query.filter_by(conversation_id=conversation_id).order_by(Message.timestamp).all()
    return jsonify([{
        'id': msg.id,
        'type': msg.type,
        'content': msg.content,
        'timestamp': msg.timestamp.isoformat(),
        'steps': msg.steps  # Add this line
    } for msg in messages]), 200

@conversations_bp.route('/<int:conversation_id>/messages', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def add_message(conversation_id):
    user_id = get_jwt_identity()
    conversation = Conversation.query.get_or_404(conversation_id)
    if conversation.user_id != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    data = request.get_json()
    new_message = Message(
        conversation_id=conversation_id,
        type=data['type'],
        content=data['content'],
        timestamp=datetime.now(),
        steps=data.get('steps')  # Add this line
    )
    db.session.add(new_message)
    db.session.commit()

    return jsonify({
        'id': new_message.id,
        'type': new_message.type,
        'content': new_message.content,
        'timestamp': new_message.timestamp.isoformat(),
        'steps': new_message.steps  # Add this line
    }), 201

@conversations_bp.route('/<int:conversation_id>/title', methods=['PUT', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def update_conversation_title(conversation_id):
    if request.method == 'OPTIONS':
        return '', 200

    user_id = get_jwt_identity()
    conversation = Conversation.query.get_or_404(conversation_id)
    if conversation.user_id != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    data = request.get_json()
    new_title = data.get('title')
    if not new_title:
        return jsonify({'message': 'Title is required'}), 400

    conversation.title = new_title
    db.session.commit()

    return jsonify({
        'id': conversation.id,
        'title': conversation.title,
        'date': conversation.date.isoformat()
    }), 200

@conversations_bp.route('/<int:conversation_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def delete_conversation(conversation_id):
    if request.method == 'OPTIONS':
        return '', 200

    user_id = get_jwt_identity()
    conversation = Conversation.query.get_or_404(conversation_id)
    if conversation.user_id != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    # Delete associated messages first
    Message.query.filter_by(conversation_id=conversation_id).delete()

    # Now delete the conversation
    db.session.delete(conversation)
    db.session.commit()

    return jsonify({'message': 'Conversation deleted successfully'}), 200
