from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, create_refresh_token, set_access_cookies, set_refresh_cookies, unset_jwt_cookies
from flask_cors import cross_origin
from models import User
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def login():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'success': True,
            'user': {'id': user.id, 'email': user.email},
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401

@auth_bp.route('/register', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def register():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')  # Add this line

    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'User already exists'}), 400

    user = User(email=email, name=name)  # Add name here
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({'success': True, 'message': 'User created successfully'}), 201

@auth_bp.route('/logout', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def logout():
    if request.method == 'OPTIONS':
        return '', 200
    resp = jsonify({'success': True, 'message': 'Logged out successfully'})
    unset_jwt_cookies(resp)
    return resp, 200

@auth_bp.route('/protected', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def protected():
    if request.method == 'OPTIONS':
        return '', 200
    current_user_id = get_jwt_identity()
    return jsonify({'logged_in_as': current_user_id}), 200

@auth_bp.route('/refresh', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required(refresh=True)
def refresh():
    if request.method == 'OPTIONS':
        return '', 200
    current_user = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user)
    return jsonify({'success': True, 'access_token': new_access_token}), 200

@auth_bp.route('/update_name', methods=['PUT', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def update_name():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    new_name = data.get('name')
    
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    user.name = new_name
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Name updated successfully'}), 200

@auth_bp.route('/user/<int:user_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    return jsonify({'success': True, 'user': {'id': user.id, 'email': user.email, 'name': user.name}}), 200