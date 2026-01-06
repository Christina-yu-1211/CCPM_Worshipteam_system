
import { User, MinistryEvent, Signup, AdminTask, EventSeries } from './types';

const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : '/api';

const fetchJson = async (endpoint: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${res.statusText}`);
    }
    return res.json();
};

export const api = {
    // --- USERS ---
    getUsers: () => fetchJson('/users') as Promise<User[]>,
    createUser: (data: Partial<User>) => fetchJson('/users', { method: 'POST', body: JSON.stringify(data) }) as Promise<User>,
    updateUser: (id: string, data: Partial<User>) => fetchJson(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<User>,
    deleteUser: (id: string) => fetchJson(`/users/${id}`, { method: 'DELETE' }),

    // --- SERIES ---
    getSeries: () => fetchJson('/series') as Promise<EventSeries[]>,
    createSeries: (data: Partial<EventSeries>) => fetchJson('/series', { method: 'POST', body: JSON.stringify(data) }) as Promise<EventSeries>,
    updateSeries: (id: string, data: Partial<EventSeries>) => fetchJson(`/series/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<EventSeries>,
    deleteSeries: (id: string) => fetchJson(`/series/${id}`, { method: 'DELETE' }),

    // --- EVENTS ---
    getEvents: () => fetchJson('/events') as Promise<MinistryEvent[]>,
    createEvent: (data: Partial<MinistryEvent>) => fetchJson('/events', { method: 'POST', body: JSON.stringify(data) }) as Promise<MinistryEvent>,
    updateEvent: (id: string, data: Partial<MinistryEvent>) => fetchJson(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<MinistryEvent>,
    deleteEvent: (id: string) => fetchJson(`/events/${id}`, { method: 'DELETE' }),

    // --- SIGNUPS ---
    getSignups: () => fetchJson('/signups') as Promise<Signup[]>,
    createSignup: (data: Partial<Signup>) => fetchJson('/signups', { method: 'POST', body: JSON.stringify(data) }) as Promise<Signup>,
    updateSignup: (id: string, data: Partial<Signup>) => fetchJson(`/signups/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<Signup>,

    // --- TASKS ---
    getTasks: () => fetchJson('/tasks') as Promise<AdminTask[]>,
    createTask: (data: Partial<AdminTask>) => fetchJson('/tasks', { method: 'POST', body: JSON.stringify(data) }) as Promise<AdminTask>,
    updateTask: (id: string, data: Partial<AdminTask>) => fetchJson(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<AdminTask>,
    deleteTask: (id: string) => fetchJson(`/tasks/${id}`, { method: 'DELETE' }),

};
