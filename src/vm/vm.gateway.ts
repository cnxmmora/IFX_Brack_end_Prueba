import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { config } from '../config/config';

@WebSocketGateway({
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  },
})
export class VmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log('📱 Usuario conectado:', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('📱 Usuario desconectado:', client.id);
  }

  emitVmEvent(eventName: string, payload: any) {
    this.server.emit(eventName, payload);
    this.server.emit('vm:changed', { event: eventName, payload });
  }
}
