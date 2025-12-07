import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { TripSeatsService } from './trip-seats.service';

type SubscribePayload = { tripId: number; lockToken?: string };

@WebSocketGateway({
  namespace: 'seat-updates',
  cors: { origin: '*', methods: ['GET', 'POST'] },
})
export class TripSeatsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server?: Server;

  private readonly logger = new Logger(TripSeatsGateway.name);

  constructor(
    @Inject(forwardRef(() => TripSeatsService))
    private readonly tripSeatsService: TripSeatsService,
  ) {}

  private roomName(tripId: number) {
    return `trip-${tripId}`;
  }

  async handleConnection(client: Socket) {
    const rawTrip = client.handshake.query?.tripId as string | undefined;
    const tripId = rawTrip ? Number(rawTrip) : undefined;
    if (tripId) {
      await client.join(this.roomName(tripId));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_client: Socket) {
    // no-op
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SubscribePayload,
  ) {
    if (!payload?.tripId) return;
    await client.join(this.roomName(payload.tripId));
    try {
      const availability = await this.tripSeatsService.getSeatMap(
        payload.tripId,
        payload.lockToken,
      );
      client.emit('seatAvailability', availability);
    } catch (err) {
      this.logger.warn(`Failed to send seat map: ${String(err)}`);
    }
  }

  broadcastAvailability(tripId: number, availability: unknown) {
    if (!this.server) return;
    this.server.to(this.roomName(tripId)).emit('seatAvailability', availability);
  }
}
