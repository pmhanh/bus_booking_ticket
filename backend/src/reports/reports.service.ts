import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Booking } from '../bookings/booking.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Trip } from '../trips/trip.entity';
import { TripSeat } from '../trips/trip-seat.entity';
import { User } from '../users/user.entity';

type SummaryRange = {
  from: Date;
  to: Date;
};

const DEFAULT_RANGE_DAYS = 7;
const MAX_RANGE_DAYS = 90;

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date: Date) => {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // Monday as start of week
  d.setDate(d.getDate() + diff);
  return d;
};

const formatYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateOnly = (value?: string): Date | null => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

const clampDays = (days?: number) => {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RANGE_DAYS;
  return Math.min(Math.floor(n), MAX_RANGE_DAYS);
};

const percentChange = (current: number, previous: number) => {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
};

const formatPercent = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const formatCompactNumber = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripSeat)
    private readonly tripSeatRepo: Repository<TripSeat>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private resolveRange(input?: {
    from?: string;
    to?: string;
    days?: number;
  }): SummaryRange {
    const now = new Date();
    const days = clampDays(input?.days);

    const parsedFrom = parseDateOnly(input?.from);
    const parsedTo = parseDateOnly(input?.to);

    const to = parsedTo ? endOfDay(parsedTo) : endOfDay(now);
    const from = parsedFrom
      ? startOfDay(parsedFrom)
      : startOfDay(new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000));

    if (from > to) {
      return { from: startOfDay(to), to: endOfDay(to) };
    }
    return { from, to };
  }

  private async sumRevenue(from?: Date, to?: Date) {
    const qb = this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin(Booking, 'booking', 'booking.id = payment.bookingId')
      .select('COALESCE(SUM(payment.amount), 0)', 'sum')
      .where('payment.status = :status', { status: 'SUCCESS' });

    qb.andWhere('booking.status = :bookingStatus', { bookingStatus: 'CONFIRMED' });

    if (from && to) {
      qb.andWhere('payment.updatedAt BETWEEN :from AND :to', { from, to });
    }

    const row = await qb.getRawOne<{ sum: string }>();
    return Number(row?.sum ?? 0) || 0;
  }

  private async getRecentBookings(limit: number) {
    const rows = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.trip', 'trip')
      .innerJoin('trip.route', 'route')
      .innerJoin('route.originCity', 'originCity')
      .innerJoin('route.destinationCity', 'destinationCity')
      .leftJoin('booking.details', 'detail')
      .select('booking.id', 'id')
      .addSelect('booking.reference', 'reference')
      .addSelect('booking.status', 'status')
      .addSelect('booking.totalPrice', 'amount')
      .addSelect('booking.createdAt', 'createdAt')
      .addSelect('originCity.name', 'origin')
      .addSelect('destinationCity.name', 'destination')
      .addSelect('COUNT(detail.id)::int', 'pax')
      .groupBy('booking.id')
      .addGroupBy('booking.reference')
      .addGroupBy('booking.status')
      .addGroupBy('booking.totalPrice')
      .addGroupBy('booking.createdAt')
      .addGroupBy('originCity.name')
      .addGroupBy('destinationCity.name')
      .orderBy('booking.createdAt', 'DESC')
      .limit(limit)
      .getRawMany<{
        id: string;
        reference: string | null;
        status: string;
        amount: number | string;
        createdAt: string;
        origin: string;
        destination: string;
        pax: number | string;
      }>();

    return rows.map((r) => ({
      id: r.reference || r.id,
      route: `${r.origin} → ${r.destination}`,
      pax: Number(r.pax) || 0,
      amount: Number(r.amount) || 0,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  private async getTopRoutes(range: SummaryRange, limit: number) {
    const rows = await this.bookingRepo
      .createQueryBuilder('booking')
      .innerJoin('booking.trip', 'trip')
      .innerJoin('trip.route', 'route')
      .innerJoin('route.originCity', 'originCity')
      .innerJoin('route.destinationCity', 'destinationCity')
      .leftJoin(
        Payment,
        'payment',
        "payment.bookingId = booking.id AND payment.status = 'SUCCESS'",
      )
      .select('route.id', 'routeId')
      .addSelect('originCity.name', 'origin')
      .addSelect('destinationCity.name', 'destination')
      .addSelect('COUNT(DISTINCT booking.id)::int', 'bookings')
      .addSelect('COALESCE(SUM(payment.amount), 0)::int', 'revenue')
      .where('booking.status = :bookingStatus', { bookingStatus: 'CONFIRMED' })
      .andWhere('trip.departureTime BETWEEN :from AND :to', range)
      .groupBy('route.id')
      .addGroupBy('originCity.name')
      .addGroupBy('destinationCity.name')
      .orderBy('bookings', 'DESC')
      .limit(limit)
      .getRawMany<{
        routeId: number | string;
        origin: string;
        destination: string;
        bookings: number | string;
        revenue: number | string;
      }>();

    const routeIds = rows
      .map((r) => Number(r.routeId))
      .filter((id) => Number.isFinite(id));

    const seatRows =
      routeIds.length === 0
        ? []
        : await this.tripSeatRepo
            .createQueryBuilder('tripSeat')
            .innerJoin('tripSeat.trip', 'trip')
            .innerJoin('trip.route', 'route')
            .select('route.id', 'routeId')
            .addSelect('COUNT(tripSeat.id)::int', 'totalSeats')
            .addSelect(
              'SUM(CASE WHEN tripSeat.isBooked THEN 1 ELSE 0 END)::int',
              'bookedSeats',
            )
            .where('route.id IN (:...routeIds)', { routeIds })
            .andWhere('trip.departureTime BETWEEN :from AND :to', range)
            .groupBy('route.id')
            .getRawMany<{
              routeId: number | string;
              totalSeats: number | string;
              bookedSeats: number | string;
            }>();

    const seatLookup = new Map(
      seatRows.map((r) => [
        Number(r.routeId),
        {
          total: Number(r.totalSeats) || 0,
          booked: Number(r.bookedSeats) || 0,
        },
      ]),
    );

    return rows.map((r) => {
      const routeId = Number(r.routeId);
      const seats = seatLookup.get(routeId);
      const totalSeats = seats?.total ?? 0;
      const bookedSeats = seats?.booked ?? 0;
      const load = totalSeats > 0 ? bookedSeats / totalSeats : 0;

      return {
        route: `${r.origin} → ${r.destination}`,
        bookings: Number(r.bookings) || 0,
        revenue: Number(r.revenue) || 0,
        load: Number(load.toFixed(4)),
        onTime: 1,
      };
    });
  }

  private async dailySeries(
    entity: 'booking' | 'payment',
    column: 'createdAt' | 'updatedAt',
    range: SummaryRange,
  ) {
    const tz = '+07';
    const dateExpr =
      entity === 'booking'
        ? `to_char(booking.${column} AT TIME ZONE '${tz}', 'YYYY-MM-DD')`
        : `to_char(payment.${column} AT TIME ZONE '${tz}', 'YYYY-MM-DD')`;

    if (entity === 'booking') {
      const rows = await this.bookingRepo
        .createQueryBuilder('booking')
        .select(dateExpr, 'date')
        .addSelect('COUNT(*)::int', 'value')
        .where(`booking.${column} BETWEEN :from AND :to`, range)
        .groupBy(dateExpr)
        .orderBy(dateExpr, 'ASC')
        .getRawMany<{ date: string; value: number | string }>();

      return rows.map((r) => ({
        date: r.date,
        value: Number(r.value) || 0,
      }));
    }

    const rows = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin(Booking, 'booking', 'booking.id = payment.bookingId')
      .select(dateExpr, 'date')
      .addSelect('COALESCE(SUM(payment.amount), 0)::int', 'value')
      .where('payment.status = :status', { status: 'SUCCESS' })
      .andWhere('booking.status = :bookingStatus', { bookingStatus: 'CONFIRMED' })
      .andWhere(`payment.${column} BETWEEN :from AND :to`, range)
      .groupBy(dateExpr)
      .orderBy(dateExpr, 'ASC')
      .getRawMany<{ date: string; value: number | string }>();

    return rows.map((r) => ({
      date: r.date,
      value: Number(r.value) || 0,
    }));
  }

  private fillMissingDays(
    range: SummaryRange,
    series: { date: string; value: number }[],
  ) {
    const lookup = new Map(series.map((p) => [p.date, p.value]));
    const out: { date: string; value: number }[] = [];
    const cursor = startOfDay(range.from);
    const last = startOfDay(range.to);

    while (cursor <= last) {
      const key = formatYYYYMMDD(cursor);
      out.push({ date: key, value: lookup.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  async getAdminSummary(input?: { from?: string; to?: string; days?: number }) {
    const range = this.resolveRange(input);

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000));
    const yesterdayEnd = endOfDay(new Date(todayStart.getTime() - 24 * 60 * 60 * 1000));

    const weekStart = startOfWeek(new Date());
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekStart.getTime() - 1);

    const [
      totalBookings,
      totalConfirmedBookings,
      totalRevenue,
      totalUsers,
      activeUsers,
      upcomingTrips,
      cancelledTrips,
      bookingsToday,
      confirmedBookingsToday,
      bookingsYesterday,
      confirmedBookingsYesterday,
      bookingsThisWeek,
      bookingsPrevWeek,
      revenueToday,
      revenueYesterday,
      revenueThisWeek,
      revenuePrevWeek,
    ] = await Promise.all([
      this.bookingRepo.count(),
      this.bookingRepo.count({ where: { status: 'CONFIRMED' } }),
      this.sumRevenue(),
      this.userRepo.count(),
      this.userRepo.count({ where: { status: 'active' } }),
      this.tripRepo.count({
        where: { status: 'SCHEDULED', departureTime: Between(new Date(), new Date('2999-12-31')) } as any,
      }),
      this.tripRepo.count({ where: { status: 'CANCELLED' } as any }),
      this.bookingRepo.count({ where: { createdAt: Between(todayStart, todayEnd) } }),
      this.bookingRepo.count({
        where: { createdAt: Between(todayStart, todayEnd), status: 'CONFIRMED' },
      }),
      this.bookingRepo.count({ where: { createdAt: Between(yesterdayStart, yesterdayEnd) } }),
      this.bookingRepo.count({
        where: { createdAt: Between(yesterdayStart, yesterdayEnd), status: 'CONFIRMED' },
      }),
      this.bookingRepo.count({ where: { createdAt: Between(weekStart, new Date()) } }),
      this.bookingRepo.count({ where: { createdAt: Between(prevWeekStart, prevWeekEnd) } }),
      this.sumRevenue(todayStart, todayEnd),
      this.sumRevenue(yesterdayStart, yesterdayEnd),
      this.sumRevenue(weekStart, new Date()),
      this.sumRevenue(prevWeekStart, prevWeekEnd),
    ]);

    const conversionToday = bookingsToday === 0 ? 0 : (confirmedBookingsToday / bookingsToday) * 100;
    const conversionYesterday =
      bookingsYesterday === 0 ? 0 : (confirmedBookingsYesterday / bookingsYesterday) * 100;
    const conversionDiff = conversionToday - conversionYesterday;

    const bookingsWoW = percentChange(bookingsThisWeek, bookingsPrevWeek);
    const revenueDoD = percentChange(revenueToday, revenueYesterday);
    const revenueWoW = percentChange(revenueThisWeek, revenuePrevWeek);

    const [bookingsDailyRaw, revenueDailyRaw] = await Promise.all([
      this.dailySeries('booking', 'createdAt', range),
      this.dailySeries('payment', 'updatedAt', range),
    ]);

    const bookingsDaily = this.fillMissingDays(range, bookingsDailyRaw);
    const revenueDaily = this.fillMissingDays(range, revenueDailyRaw);

    const [topRoutes, recentBookings] = await Promise.all([
      this.getTopRoutes(range, 3),
      this.getRecentBookings(8),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: {
        bookings: totalBookings,
        confirmedBookings: totalConfirmedBookings,
        users: totalUsers,
        activeUsers,
        revenue: totalRevenue,
        trips: {
          upcoming: upcomingTrips,
          cancelled: cancelledTrips,
        },
      },
      today: {
        bookings: bookingsToday,
        confirmedBookings: confirmedBookingsToday,
        revenue: revenueToday,
        conversionRate: Number(conversionToday.toFixed(2)),
      },
      thisWeek: {
        from: weekStart.toISOString(),
        to: new Date().toISOString(),
        bookings: bookingsThisWeek,
        revenue: revenueThisWeek,
      },
      trends: {
        bookingsWoW: bookingsWoW == null ? null : Number(bookingsWoW.toFixed(2)),
        revenueDoD: revenueDoD == null ? null : Number(revenueDoD.toFixed(2)),
        revenueWoW: revenueWoW == null ? null : Number(revenueWoW.toFixed(2)),
        conversionDoD: Number(conversionDiff.toFixed(2)),
      },
      daily: {
        bookings: bookingsDaily,
        revenue: revenueDaily,
      },
      topRoutes,
      recentBookings,
      dashboardSummary: [
        {
          label: 'Tổng booking',
          value: totalBookings.toLocaleString('en-US'),
          trend: `${formatPercent(bookingsWoW)} WoW`,
        },
        {
          label: 'Active users',
          value: activeUsers.toLocaleString('en-US'),
          trend: '—',
        },
        {
          label: 'Doanh thu hôm nay',
          value: formatCompactNumber(revenueToday),
          trend: `${formatPercent(revenueDoD)} DoD`,
        },
        {
          label: 'Conversion rate',
          value: `${conversionToday.toFixed(1)}%`,
          trend: `${conversionDiff >= 0 ? '+' : ''}${conversionDiff.toFixed(1)} pts DoD`,
        },
      ],
    };
  }
}
