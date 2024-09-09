from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from flask_cors import cross_origin
from app import supabase

agents_bp = Blueprint('agents', __name__)

@agents_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_agents():
    if request.method == 'OPTIONS':
        return '', 200
    agents = supabase.table('agent').select('*').execute()
    return jsonify([{'id': agent['id'], 'name': agent['name'], 'type': agent['type'], 'description': agent['description']} for agent in agents.data]), 200

@agents_bp.route('/<int:agent_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_agent(agent_id):
    if request.method == 'OPTIONS':
        return '', 200
    agent = supabase.table('agent').select('*').eq('id', agent_id).execute()
    if not agent.data:
        return jsonify({'message': 'Agent not found'}), 404
    return jsonify({'id': agent.data[0]['id'], 'name': agent.data[0]['name'], 'type': agent.data[0]['type'], 'description': agent.data[0]['description']}), 200
