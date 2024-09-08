from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin
from app import supabase
from datetime import datetime
from postgrest.exceptions import APIError

conversations_bp = Blueprint('conversations', __name__)

@conversations_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_conversations():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_jwt_identity()
    conversations = supabase.table('conversation').select('*').eq('user_id', user_id).execute()
    return jsonify([{
        'id': conv['id'],
        'title': conv['title'],
        'date': conv['date']
    } for conv in conversations.data]), 200

@conversations_bp.route('/', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def create_conversation():
    if request.method == 'OPTIONS':
        return '', 200
    
    user_id = get_jwt_identity()
    data = request.get_json()
    title = data.get('title')
    date = datetime.now().isoformat()

    new_conversation = supabase.table('conversation').insert({
        'user_id': user_id,
        'title': title,
        'date': date
    }).execute()

    return jsonify({
        'id': new_conversation.data[0]['id'],
        'title': new_conversation.data[0]['title'],
        'date': new_conversation.data[0]['date']
    }), 201

@conversations_bp.route('/<int:conversation_id>/messages', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_messages(conversation_id):
    user_id = get_jwt_identity()
    conversation = supabase.table('conversation').select('*').eq('id', conversation_id).execute()
    if not conversation.data:
        return jsonify({'message': 'Conversation not found'}), 404
    if conversation.data[0]['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    messages = supabase.table('message').select('*').eq('conversation_id', conversation_id).order('timestamp').execute()
    return jsonify([{
        'id': msg['id'],
        'type': msg['type'],
        'content': msg['content'],
        'timestamp': msg['timestamp'],
        'steps': msg['steps']
    } for msg in messages.data]), 200

@conversations_bp.route('/<int:conversation_id>/messages', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def add_message(conversation_id):
    user_id = get_jwt_identity()
    conversation = supabase.table('conversation').select('*').eq('id', conversation_id).execute()
    if not conversation.data:
        return jsonify({'message': 'Conversation not found'}), 404
    if conversation.data[0]['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    data = request.get_json()

    try:
        # Fetch the current maximum ID
        max_id_result = supabase.table('message').select('id').order('id', desc=True).limit(1).execute()
        next_id = 1 if not max_id_result.data else max_id_result.data[0]['id'] + 1

        new_message = {
            'id': next_id,  # Explicitly set the next ID
            'conversation_id': conversation_id,
            'type': data['type'],
            'content': data['content'],
            'timestamp': datetime.now().isoformat(),
            'steps': data.get('steps')
        }

        # Insert the new message with the explicit ID
        result = supabase.table('message').insert(new_message).execute()
        inserted_message = result.data[0]

        return jsonify({
            'id': inserted_message['id'],
            'type': inserted_message['type'],
            'content': inserted_message['content'],
            'timestamp': inserted_message['timestamp'],
            'steps': inserted_message['steps']
        }), 201

    except APIError as e:
        print(f"Error inserting message: {str(e)}")
        return jsonify({'message': 'Failed to insert message'}), 500

@conversations_bp.route('/<int:conversation_id>/title', methods=['PUT', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def update_conversation_title(conversation_id):
    if request.method == 'OPTIONS':
        return '', 200

    user_id = get_jwt_identity()
    conversation = supabase.table('conversation').select('*').eq('id', conversation_id).execute()
    if not conversation.data:
        return jsonify({'message': 'Conversation not found'}), 404
    if conversation.data[0]['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    data = request.get_json()
    new_title = data.get('title')
    if not new_title:
        return jsonify({'message': 'Title is required'}), 400

    updated_conversation = supabase.table('conversation').update({'title': new_title}).eq('id', conversation_id).execute()
    updated_data = updated_conversation.data[0]

    return jsonify({
        'id': updated_data['id'],
        'title': updated_data['title'],
        'date': updated_data['date']
    }), 200

@conversations_bp.route('/<int:conversation_id>', methods=['DELETE', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def delete_conversation(conversation_id):
    if request.method == 'OPTIONS':
        return '', 200

    user_id = get_jwt_identity()
    conversation = supabase.table('conversation').select('*').eq('id', conversation_id).execute()
    if not conversation.data:
        return jsonify({'message': 'Conversation not found'}), 404
    if conversation.data[0]['user_id'] != user_id:
        return jsonify({'message': 'Unauthorized'}), 401

    # Delete associated messages first
    supabase.table('message').delete().eq('conversation_id', conversation_id).execute()

    # Now delete the conversation
    supabase.table('conversation').delete().eq('id', conversation_id).execute()

    return jsonify({'message': 'Conversation deleted successfully'}), 200
