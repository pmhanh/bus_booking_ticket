import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export type SeatChange = {
  seatCode: string;
  status: 'held' | 'released' | 'booked';
  expiresAt?: string;
};

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
})
export class SeatGateway {
  @WebSocketServer()
  server: Server;

  private room(tripId: number) {
    return `trip:${tripId}`;
  }

  emitSeatsChanged(tripId: number, changes: SeatChange[]) {
    this.server.to(this.room(tripId)).emit('trip_seats_changed', {
      tripId,
      changes,
      at: new Date().toISOString(),
    });
  }

  @SubscribeMessage('join_trip')
  handleJoinTrip(
    @MessageBody('tripId') tripId: number,
    @ConnectedSocket() socket: Socket,
  ) {
    if (!tripId) return;
    socket.join(this.room(Number(tripId)));
  }
}
