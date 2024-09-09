from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from flask_cors import cross_origin
from app import supabase

tools_bp = Blueprint('tools', __name__)

@tools_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_tools():
    if request.method == 'OPTIONS':
        return '', 200
    tools = supabase.table('tool').select('*').execute()
    return jsonify([{'id': tool['id'], 'name': tool['name'], 'description': tool['description'], 'api_endpoint': tool['api_endpoint']} for tool in tools.data]), 200

@tools_bp.route('/<int:tool_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_tool(tool_id):
    if request.method == 'OPTIONS':
        return '', 200
    tool = supabase.table('tool').select('*').eq('id', tool_id).execute()
    if not tool.data:
        return jsonify({'message': 'Tool not found'}), 404
    return jsonify({'id': tool.data[0]['id'], 'name': tool.data[0]['name'], 'description': tool.data[0]['description'], 'api_endpoint': tool.data[0]['api_endpoint']}), 200