from flask import Blueprint, jsonify, request
from app import db
from models import Agent
from flask_jwt_extended import jwt_required
from flask_cors import cross_origin

agents_bp = Blueprint('agents', __name__)

@agents_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_agents():
    if request.method == 'OPTIONS':
        return '', 200
    agents = Agent.query.all()
    return jsonify([{'id': agent.id, 'name': agent.name, 'type': agent.type, 'description': agent.description} for agent in agents]), 200

@agents_bp.route('/<int:agent_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_agent(agent_id):
    if request.method == 'OPTIONS':
        return '', 200
    agent = Agent.query.get_or_404(agent_id)
    return jsonify({'id': agent.id, 'name': agent.name, 'type': agent.type, 'description': agent.description}), 200
