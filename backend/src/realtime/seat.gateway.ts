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

  private emitTripEvent(tripId: number, payload: Record<string, unknown>) {
    this.server.to(this.room(tripId)).emit('trip_seats_changed', payload);
  }

  emitSeatHeld(tripId: number, seatCodes: string[], expiresAt?: string) {
    const at = new Date().toISOString();
    this.server.to(this.room(tripId)).emit('seatHeld', { tripId, seatCodes, expiresAt, at });
    this.emitTripEvent(tripId, {
      tripId,
      changes: seatCodes.map((seatCode) => ({
        seatCode,
        status: 'held',
        expiresAt,
      })),
      at,
    });
  }

  emitSeatReleased(tripId: number, seatCodes: string[]) {
    const at = new Date().toISOString();
    this.server.to(this.room(tripId)).emit('seatReleased', { tripId, seatCodes, at });
    this.emitTripEvent(tripId, {
      tripId,
      changes: seatCodes.map((seatCode) => ({
        seatCode,
        status: 'released',
      })),
      at,
    });
  }

  emitSeatBooked(tripId: number, seatCodes: string[]) {
    const at = new Date().toISOString();
    this.server.to(this.room(tripId)).emit('seatBooked', { tripId, seatCodes, at });
    this.emitTripEvent(tripId, {
      tripId,
      changes: seatCodes.map((seatCode) => ({
        seatCode,
        status: 'booked',
      })),
      at,
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

  // alias camelCase per spec
  @SubscribeMessage('joinTrip')
  handleJoinTripAlias(
    @MessageBody() data: { tripId: number },
    @ConnectedSocket() socket: Socket,
  ) {
    if (!data?.tripId) return;
    socket.join(this.room(Number(data.tripId)));
  }
}
