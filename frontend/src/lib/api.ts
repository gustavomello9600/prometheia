import axios from 'axios';
import { getSession, useSession, signOut } from 'next-auth/react';

const API_BASE_URL = 'http://localhost:5000';

// Add this function
async function updateSession(newData: { access_token: string }) {
  const { data: session, update } = useSession();
  if (session) {
    await update({
      ...session,
      access_token: newData.access_token,
    });
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
  },
});

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.access_token) {
    config.headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        refreshApi.post('/api/auth/refresh', {}, {
          headers: { 'Authorization': async () => `Bearer ${(await getSession())?.refresh_token}` }
        })
          .then(async ({ data }) => {
            const { access_token } = data;
            // Update the session with the new access token
            await updateSession({ access_token });
            api.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;
            originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
            processQueue(null, access_token);
            resolve(api(originalRequest));
          })
          .catch((err) => {
            processQueue(err, null);
            reject(err);
            // If refresh fails, sign out the user
            signOut({ callbackUrl: '/login' });
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

export const login = async (email: string, password: string) => {
  const response = await api.post('/api/auth/login', { email, password });
  return response.data;
};

export const register = async (email: string, password: string, name: string) => {
  const response = await api.post('/api/auth/register', { email, password, name });
  return response.data;
};

export const createTask = async (prompt: string) => {
  try {
    const response = await api.post('/tasks', { prompt });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getAgents = async () => {
  try {
    const response = await api.get('/agents');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getTools = async () => {
  try {
    const response = await api.get('/tools');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getTasks = async () => {
  try {
    const response = await api.get('/tasks');
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const llmInteraction = async (prompt: string) => {
  try {
    const response = await api.post('/llm', { prompt });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getConversations = async () => {
  try {
    const response = await api.get('/api/conversations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export const createConversation = async (title: string, date: string) => {
  try {
    const response = await api.post('/api/conversations/', { title, date });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const updateConversationTitle = async (conversationId: number, newTitle: string) => {
  const response = await api.put(`/api/conversations/${conversationId}/title`, { title: newTitle });
  return response.data;
};

export const updateUserName = async (name: string) => {
  const response = await api.put('/api/auth/update_name', { name });
  return response.data;
};

export const getUserById = async (userId: string) => {
  const response = await api.get(`api/auth/user/${userId}`);
  return response.data;
};

export const deleteConversation = async (conversationId: number) => {
  const response = await api.delete(`/api/conversations/${conversationId}`);
  return response.data;
};

export const getMessages = async (conversationId: number) => {
  try {
    const response = await api.get(`/api/conversations/${conversationId}/messages`);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
};

export const createMessage = async (conversationId: number, message: Message) => {
  try {
    const response = await api.post(`/api/conversations/${conversationId}/messages`, {
      type: message.type,
      content: message.content,
      steps: message.steps  // Add this line
    });
    return response.data;
  } catch (error) {
    console.error('Error creating message:', error);
    throw error;
  }
};

export const getLLMResponse = async (conversationHistory: string, conversationId: number) => {
  try {
    const response = await api.post('/llm', { 
      prompt: conversationHistory,
      conversation_id: conversationId
    });
    return response.data;
  } catch (error) {
    console.error('Error getting LLM response:', error);
    throw error;
  }
};