from flask import Blueprint, jsonify, request
from app import db
from models import Tool
from flask_jwt_extended import jwt_required
from flask_cors import cross_origin

tools_bp = Blueprint('tools', __name__)

@tools_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_tools():
    if request.method == 'OPTIONS':
        return '', 200
    tools = Tool.query.all()
    return jsonify([{'id': tool.id, 'name': tool.name, 'description': tool.description, 'api_endpoint': tool.api_endpoint} for tool in tools]), 200

@tools_bp.route('/<int:tool_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_tool(tool_id):
    if request.method == 'OPTIONS':
        return '', 200
    tool = Tool.query.get_or_404(tool_id)
    return jsonify({'id': tool.id, 'name': tool.name, 'description': tool.description, 'api_endpoint': tool.api_endpoint}), 200