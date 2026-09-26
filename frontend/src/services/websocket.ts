type MessageHandler = (data: any) => void;

export class AuctionWebSocket {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler[] = [];
  private reconnectInterval: number = 2000;
  private isExplicitClose: boolean = false;
  private reconnectTimer: number | null = null;

  public connect() {
    this.isExplicitClose = false;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    let wsUrl: string;
    const envApiUrl = import.meta.env.VITE_API_URL;
    if (envApiUrl) {
      try {
        const parsed = new URL(envApiUrl);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${parsed.host}/ws/auction`;
      } catch {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        wsUrl = `${protocol}//${host}/ws/auction`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/ws/auction`;
    }

    console.log(`Connecting to WebSocket: ${wsUrl}`);
    const connection = new WebSocket(wsUrl);
    this.ws = connection;

    connection.onopen = () => {
      console.log('WebSocket connected');
    };

    connection.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(message));
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    connection.onclose = () => {
      console.log('WebSocket connection closed.');
      if (this.ws === connection) this.ws = null;
      if (!this.isExplicitClose) {
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, this.reconnectInterval);
      }
    };

    connection.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }

  public subscribe(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  public disconnect() {
    this.isExplicitClose = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const connection = this.ws;
    this.ws = null;
    if (connection) {
      connection.onclose = null;
      connection.close();
    }
  }
}

export const auctionWs = new AuctionWebSocket();
