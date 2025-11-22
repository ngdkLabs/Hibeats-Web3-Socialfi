import { advancedDatastreamService } from '@/services/somniaDatastreamService.advanced';

export type ChatDeliveryStatus = 'pending' | 'sent' | 'received';

export interface LiveChatMessage {
  id: string;
  tempId?: string;
  conversationId: string;
  sender: string;
  content: string;
  timestamp: number;
  status: ChatDeliveryStatus;
}

class RealtimeChatService {
  private initialized = false;
  private listeners: Map<string, Set<(message: LiveChatMessage) => void>> = new Map();
  private cache: Map<string, LiveChatMessage[]> = new Map();
  private broadcast?: BroadcastChannel;
  private latencySamples: number[] = [];

  async initialize(walletClient?: any): Promise<void> {
    if (this.initialized) return;

    try {
      await advancedDatastreamService.connect(walletClient);
    } catch (error) {
      console.error('❌ [CHAT-REALTIME] Failed to initialize datastream, continuing with local realtime only', error);
    }

    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcast = new BroadcastChannel('hibeats-chat');
      this.broadcast.addEventListener('message', (event) => {
        const incoming = event.data as LiveChatMessage;
        this.emit(incoming.conversationId, { ...incoming, status: 'sent' });
      });
    }

    this.initialized = true;
  }

  bootstrapConversation(conversationId: string, messages: LiveChatMessage[]): void {
    if (messages.length === 0) return;
    const existing = this.cache.get(conversationId) ?? [];
    const merged = [...existing];

    messages.forEach((message) => {
      const hasMessage = merged.some(
        (item) => item.id === message.id || (item.tempId && item.tempId === message.tempId)
      );
      if (!hasMessage) {
        merged.push(message);
      }
    });

    this.cache.set(conversationId, merged.sort((a, b) => a.timestamp - b.timestamp));
  }

  subscribe(conversationId: string, callback: (message: LiveChatMessage) => void): () => void {
    if (!this.initialized) {
      void this.initialize();
    }

    const listeners = this.listeners.get(conversationId) ?? new Set();
    listeners.add(callback);
    this.listeners.set(conversationId, listeners);

    const cached = this.cache.get(conversationId) ?? [];
    cached.forEach((message) => callback(message));

    return () => {
      const current = this.listeners.get(conversationId);
      if (!current) return;
      current.delete(callback);
      if (current.size === 0) {
        this.listeners.delete(conversationId);
      }
    };
  }

  async sendMessage(conversationId: string, sender: string, content: string): Promise<LiveChatMessage> {
    await this.initialize();

    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const pendingMessage: LiveChatMessage = {
      id: tempId,
      tempId,
      conversationId,
      sender,
      content,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.emit(conversationId, pendingMessage);

    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const confirmDelivery = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.latencySamples.push(now - startTime);

      const delivered: LiveChatMessage = {
        ...pendingMessage,
        id: `msg-${Date.now()}`,
        status: 'sent'
      };

      this.emit(conversationId, delivered);
      this.broadcast?.postMessage(delivered);
    };

    try {
      await advancedDatastreamService.connect();
      // In a real deployment we would publish the message to the chain or a websocket server here.
    } catch (error) {
      console.warn('⚠️ [CHAT-REALTIME] Falling back to local realtime delivery', error);
    } finally {
      setTimeout(confirmDelivery, 10);
    }

    return pendingMessage;
  }

  getLatencyStats(): { average: number; latest: number } | null {
    if (this.latencySamples.length === 0) return null;

    const total = this.latencySamples.reduce((sum, sample) => sum + sample, 0);
    const average = total / this.latencySamples.length;
    const latest = this.latencySamples[this.latencySamples.length - 1];

    return {
      average: Math.round(average),
      latest: Math.round(latest)
    };
  }

  private emit(conversationId: string, message: LiveChatMessage): void {
    const existing = this.cache.get(conversationId) ?? [];
    const updated = [...existing];

    const index = updated.findIndex(
      (item) => item.id === message.id || (item.tempId && item.tempId === message.tempId)
    );

    if (index >= 0) {
      updated[index] = { ...updated[index], ...message };
    } else {
      updated.push(message);
    }

    updated.sort((a, b) => a.timestamp - b.timestamp);
    this.cache.set(conversationId, updated);

    const listeners = this.listeners.get(conversationId);
    listeners?.forEach((callback) => callback(message));
  }
}

export const realtimeChatService = new RealtimeChatService();
export default realtimeChatService;
