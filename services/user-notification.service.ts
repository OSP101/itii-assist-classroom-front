import api from "./api.service";

export interface UserNotificationItem {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    course_id?: string;
    link?: string;
    data?: Record<string, unknown>;
    is_read: boolean;
    read_at?: string | null;
    created_at: string;
}

interface ListResponse {
    success: boolean;
    data: UserNotificationItem[];
    meta?: {
        total?: number;
        unread_count?: number;
        limit?: number;
        offset?: number;
    };
}

interface CountResponse {
    success: boolean;
    data?: {
        unread_count?: number;
    };
}

const userNotificationService = {
    async getNotifications(limit = 20, offset = 0): Promise<{ items: UserNotificationItem[]; total: number }> {
        const response = await api.get<ListResponse>(`/notifications?limit=${limit}&offset=${offset}`) as unknown as ListResponse;
        return {
            items: response.data ?? [],
            total: response.meta?.total ?? 0,
        };
    },

    async getUnreadCount(): Promise<number> {
        const response = await api.get<CountResponse>("/notifications/count") as unknown as CountResponse;
        return response.data?.unread_count ?? 0;
    },

    async markRead(id: number): Promise<boolean> {
        const response = await api.patch<{ success: boolean }>(`/notifications/${id}/read`) as unknown as { success: boolean };
        return !!response.success;
    },

    async markAllRead(): Promise<boolean> {
        const response = await api.patch<{ success: boolean }>("/notifications/read-all") as unknown as { success: boolean };
        return !!response.success;
    },

    async clearRead(): Promise<boolean> {
        const response = await api.delete<{ success: boolean }>("/notifications/clear") as unknown as { success: boolean };
        return !!response.success;
    },
};

export default userNotificationService;
