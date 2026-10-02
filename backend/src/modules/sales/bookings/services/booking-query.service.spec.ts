import { Repository } from 'typeorm';
import { Booking } from '../entities/booking.entity';
import { BookingQueryService } from './booking-query.service';

describe('Admin booking departure date filters', () => {
  function fixture() {
    const query = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const repo = { manager: { getRepository: () => ({ createQueryBuilder: () => query }) } };
    return { query, service: new BookingQueryService(repo as unknown as Repository<Booking>) };
  }

  it('includes the entire selected Vietnam day using departure time, not booking creation', async () => {
    const { service, query } = fixture();
    await service.listForAdmin({ fromDate: '2026-09-29', toDate: '2026-09-29', limit: 20, offset: 0 });
    expect(query.andWhere.mock.calls).toEqual([
      ['trip.departureTime >= :from', { from: new Date('2026-09-28T17:00:00Z') }],
      ['trip.departureTime < :to', { to: new Date('2026-09-29T17:00:00Z') }],
    ]);
  });

  it('includes the last day across a month boundary', async () => {
    const { service, query } = fixture();
    await service.listForAdmin({ toDate: '2026-09-30', limit: 20, offset: 0 });
    expect(query.andWhere).toHaveBeenCalledWith('trip.departureTime < :to', { to: new Date('2026-10-01T00:00:00+07:00') });
  });

  it('removes date conditions when filters are cleared', async () => {
    const { service, query } = fixture();
    await service.listForAdmin({ limit: 20, offset: 0 });
    expect(query.andWhere).not.toHaveBeenCalled();
  });

  it('rejects reversed date ranges', async () => {
    const { service } = fixture();
    await expect(service.listForAdmin({ fromDate: '2026-09-30', toDate: '2026-09-29', limit: 20, offset: 0 })).rejects.toThrow('fromDate');
  });
});
