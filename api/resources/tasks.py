from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin
from app import supabase
from mode_selection import ModeSelector
from planner import Planner
from multi_agent_coordinator import MultiAgentCoordinator
from llm_interaction import LLMInteraction

tasks_bp = Blueprint('tasks', __name__)

# Initialize modules
mode_selector = ModeSelector()
planner = Planner()
coordinator = MultiAgentCoordinator()
llm = LLMInteraction()

@tasks_bp.route('/', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def create_task():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_jwt_identity()
    data = request.get_json()
    request_text = data['request']

    mode = mode_selector.select_mode(request_text)

    task = {
        'user_id': user_id,
        'request': request_text,
        'status': 'Pending',
        'mode': mode
    }

    new_task = supabase.table('task').insert(task).execute()
    task_id = new_task.data[0]['id']

    # ... (rest of the logic remains similar)

    supabase.table('task').update(task).eq('id', task_id).execute()
    return jsonify({'task_id': task_id}), 201

# ... (update other routes similarly)
