from flask import Blueprint, request, jsonify, session
from app import db
from models import Task
from mode_selection import ModeSelector
from planner import Planner
from multi_agent_coordinator import MultiAgentCoordinator
from llm_interaction import LLMInteraction
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin

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

    task = Task(user_id=user_id, request=request_text, status='Pending', mode=mode)
    db.session.add(task)
    db.session.commit()

    if mode == "Direct Response":
        response = llm.get_response(request_text)
        task.result = response
        task.status = 'Completed'
    elif mode == "Planner":
        plan = planner.generate_plan(request_text)
        task.plan = plan
        task.result = execute_plan(plan)
        task.status = 'Completed'
    elif mode == "Multi-Agent":
        selected_agents = coordinator.select_agents(request_text)
        result = coordinator.coordinate_task(request_text, selected_agents)
        task.result = result
        task.status = 'Completed'

    db.session.commit()
    return jsonify({'task_id': task.id}), 201

def execute_plan(plan):
    # Implement plan execution logic
    return "Plan executed successfully"

@tasks_bp.route('/<int:task_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_task(task_id):
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_jwt_identity()
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()

    if not task:
        return jsonify({'message': 'Task not found'}), 404

    return jsonify({
        'id': task.id,
        'request': task.request,
        'status': task.status,
        'result': task.result,
        'mode': task.mode,
        'plan': task.plan
    }), 200

@tasks_bp.route('/', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_tasks():
    if request.method == 'OPTIONS':
        return '', 200
    user_id = get_jwt_identity()
    tasks = Task.query.filter_by(user_id=user_id).all()

    tasks_list = [{
        'id': task.id,
        'request': task.request,
        'status': task.status,
        'result': task.result,
        'mode': task.mode,
        'plan': task.plan
    } for task in tasks]

    return jsonify(tasks_list), 200
