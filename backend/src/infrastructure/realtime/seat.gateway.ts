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

  // Hàm gốc phát sự kiện tổng hợp duy nhất
  emitChanges(tripId: number, changes: SeatChange[]) {
    const at = new Date().toISOString();
    this.server.to(this.room(tripId)).emit('trip_seats_changed', {
      tripId,
      changes,
      at,
    });
  }

  emitSeatHeld(tripId: number, seatCodes: string[], expiresAt?: string) {
    this.emitChanges(
      tripId,
      seatCodes.map((seatCode) => ({ seatCode, status: 'held', expiresAt })),
    );
  }

  emitSeatReleased(tripId: number, seatCodes: string[]) {
    this.emitChanges(
      tripId,
      seatCodes.map((seatCode) => ({ seatCode, status: 'released' })),
    );
  }

  @SubscribeMessage('joinTrip')
  handleJoinTrip(
    @MessageBody() data: any, // Lấy toàn bộ data (chấp nhận cả Object lẫn Giá trị đơn)
    @ConnectedSocket() socket: Socket,
  ) {
    // Nếu data gửi lên là Object { tripId: 10 } thì lấy data.tripId.
    // Nếu data gửi thẳng số 10 thì lấy chính data.
    const tripId = data && typeof data === 'object' ? data.tripId : data;

    if (!tripId) return;
    socket.join(this.room(Number(tripId)));
  }
}
