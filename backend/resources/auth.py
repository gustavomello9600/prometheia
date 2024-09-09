from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, create_refresh_token, unset_jwt_cookies
from flask_cors import cross_origin
from werkzeug.security import generate_password_hash, check_password_hash
from app import supabase

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
@cross_origin(supports_credentials=True)
def login():
    if request.method == 'OPTIONS':
        return '', 200
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = supabase.table('user').select('*').eq('email', email).execute().data
    if user and check_password_hash(user[0]['password_hash'], password):
        access_token = create_access_token(identity=user[0]['id'])
        refresh_token = create_refresh_token(identity=user[0]['id'])
        
        return jsonify({
            'success': True,
            'user': {'id': user[0]['id'], 'email': user[0]['email']},
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
    name = data.get('name')

    existing_user = supabase.table('user').select('*').eq('email', email).execute().data
    if existing_user:
        return jsonify({'success': False, 'message': 'User already exists'}), 400

    password_hash = generate_password_hash(password)
    new_user = supabase.table('user').insert({'email': email, 'password_hash': password_hash, 'name': name}).execute()
    
    if new_user.data:
        return jsonify({'success': True, 'message': 'User created successfully'}), 201
    else:
        return jsonify({'success': False, 'message': 'Failed to create user'}), 500

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
    
    updated_user = supabase.table('user').update({'name': new_name}).eq('id', current_user_id).execute()
    
    if updated_user.data:
        return jsonify({'success': True, 'message': 'Name updated successfully'}), 200
    else:
        return jsonify({'success': False, 'message': 'Failed to update name'}), 500

@auth_bp.route('/user/<int:user_id>', methods=['GET', 'OPTIONS'])
@cross_origin(supports_credentials=True)
@jwt_required()
def get_user(user_id):
    if request.method == 'OPTIONS':
        return '', 200
    user = supabase.table('user').select('id', 'email', 'name').eq('id', user_id).execute().data
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    return jsonify({'success': True, 'user': user[0]}), 200