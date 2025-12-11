import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from './booking.entity';

@Injectable()
export class BookingReferenceService {
  private readonly alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  private generate() {
    let ref = '';
    for (let i = 0; i < 8; i++) {
      ref += this.alphabet[Math.floor(Math.random() * this.alphabet.length)];
    }
    return ref;
  }

  async generateUnique() {
    let ref = this.generate();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await this.bookingRepo.findOne({ where: { reference: ref } });
      if (!existing) return ref;
      ref = this.generate();
    }
  }
}
