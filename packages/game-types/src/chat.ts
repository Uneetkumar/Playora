export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  message: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface PlayerReaction {
  id: string;
  roomId: string;
  senderId: string;
  emoji: string;
  timestamp: number;
}
