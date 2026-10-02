import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { MailService } from '../../../../infrastructure/mail/mail.service';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { bookingSeatCodes } from '../utils/booking.utils';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
}

@Injectable()
export class BookingTicketService {
  private readonly logger = new Logger(BookingTicketService.name);
  constructor(private readonly mail: MailService) {}

  private lines(booking: Booking) {
    const trip = booking.trip;
    const formatTime = (time: Date) =>
      new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(time);
    const stopTime = (offset: number) =>
      formatTime(new Date(trip.departureTime.getTime() + offset * 60000));
    return [
      `Booking Reference: ${booking.reference || booking.id}`,
      `Status: ${booking.status}`,
      `Route: ${trip.route.originCity.name} -> ${trip.route.destinationCity.name}`,
      `Pickup: ${booking.pickupStop?.city.name ?? trip.route.originCity.name}`,
      `Departure: ${booking.pickupStop ? stopTime(booking.pickupStop.estimatedOffsetMinutes) : formatTime(trip.departureTime)} (GMT+7)`,
      `Dropoff: ${booking.dropoffStop?.city.name ?? trip.route.destinationCity.name}`,
      `Arrival: ${booking.dropoffStop ? stopTime(booking.dropoffStop.estimatedOffsetMinutes) : formatTime(trip.arrivalTime)} (GMT+7)`,
      `Seats: ${bookingSeatCodes(booking).join(', ')}`,
      `Contact: ${booking.contactName} (${booking.contactEmail})`,
      `Total: ${booking.totalPrice.toLocaleString('vi-VN')} VND`,
    ];
  }

  async content(booking: Booking) {
    if (booking.status !== BookingStatus.CONFIRMED)
      throw new BadRequestException(
        'Ticket only available for confirmed bookings',
      );
    const qrCodeDataUrl = await QRCode.toDataURL(
      booking.reference || booking.id,
      {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
      },
    );
    return { booking, content: this.lines(booking).join('\n'), qrCodeDataUrl };
  }

  async send(booking: Booking) {
    if (!this.mail.isConfigured())
      throw new BadRequestException('Email service not configured');
    const { content, qrCodeDataUrl } = await this.content(booking);
    const cid = `booking-qr-${booking.id}`;
    await this.mail.sendMail({
      to: booking.contactEmail,
      subject: `E-ticket for booking ${booking.reference || booking.id}`,
      text: content,
      html: `<div>${content
        .split('\n')
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('')}<img src="cid:${cid}" alt="Booking QR" /></div>`,
      attachments: [
        {
          filename: `ticket-${booking.reference || booking.id}.png`,
          content: Buffer.from(qrCodeDataUrl.split(',')[1], 'base64'),
          contentType: 'image/png',
          cid,
        },
      ],
      throwOnError: true,
    });
    return { ok: true };
  }

  async trySend(booking: Booking) {
    if (!this.mail.isConfigured()) return;
    try {
      await this.send(booking);
    } catch (error) {
      this.logger.warn(`Could not send ticket ${booking.id}: ${String(error)}`);
    }
  }
}
