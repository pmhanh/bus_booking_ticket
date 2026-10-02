import { BusesService } from './buses.service';

describe('BusesService image storage', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/bus.jpg';
  const publicId = 'bus-booking/buses/photo';
  let bus: any;
  let repo: any;
  let manager: any;
  let images: any;
  let service: BusesService;

  beforeEach(() => {
    bus = { id: 1, photos: [url], photoPublicIds: { [url]: publicId } };
    manager = {
      findOne: jest.fn().mockResolvedValue(bus),
      save: jest.fn().mockResolvedValue(bus),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repo = {
      findOne: jest.fn().mockResolvedValue(bus),
      manager: {
        transaction: jest.fn().mockImplementation((fn) => fn(manager)),
      },
    };
    images = {
      uploadImage: jest
        .fn()
        .mockResolvedValue({ url: `${url}?new`, publicId: `${publicId}-new` }),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      cleanupImage: jest.fn().mockResolvedValue(undefined),
    };
    service = new BusesService(repo, {} as any, {} as any, images);
  });

  it('appends uploaded URLs and records their deletion IDs', async () => {
    const result = await service.addPhoto(1, {} as Express.Multer.File);
    expect(result.photos).toEqual([url, `${url}?new`]);
    expect(result.photoPublicIds[`${url}?new`]).toBe(`${publicId}-new`);
  });

  it('cleans up a new image if saving it fails', async () => {
    manager.save.mockRejectedValue(new Error('DB failed'));
    await expect(
      service.addPhoto(1, {} as Express.Multer.File),
    ).rejects.toThrow('DB failed');
    expect(images.cleanupImage).toHaveBeenCalledWith(`${publicId}-new`);
  });

  it('rejects attempts to delete images not belonging to the bus', async () => {
    await expect(
      service.deletePhoto(1, 'https://other/image.jpg'),
    ).rejects.toThrow('Photo not found');
    expect(images.deleteImage).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('deletes with the stored public ID and removes the URL', async () => {
    await service.deletePhoto(1, url);
    expect(images.deleteImage).toHaveBeenCalledWith(publicId);
    expect(bus.photos).toEqual([]);
    expect(bus.photoPublicIds).toEqual({});
  });

  it('keeps the reference for retry when Cloudinary deletion fails', async () => {
    images.deleteImage.mockRejectedValue(new Error('Cloudinary unavailable'));
    await expect(service.deletePhoto(1, url)).rejects.toThrow(
      'Cloudinary unavailable',
    );
    expect(bus.photos).toEqual([url]);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('removes a legacy reference without trying to delete an arbitrary cloud asset', async () => {
    bus.photos = ['legacy.jpg'];
    bus.photoPublicIds = {};
    await service.deletePhoto(1, 'legacy.jpg');
    expect(bus.photos).toEqual([]);
    expect(images.deleteImage).not.toHaveBeenCalled();
  });

  it('cleans up bus images after deleting the bus', async () => {
    await service.delete(1);
    expect(images.cleanupImage).toHaveBeenCalledWith(publicId);
  });

  it('keeps cloud images when a bus cannot be deleted due to DB constraints', async () => {
    manager.delete.mockRejectedValue(new Error('Foreign key constraint'));
    await expect(service.delete(1)).rejects.toThrow('Foreign key constraint');
    expect(images.cleanupImage).not.toHaveBeenCalled();
  });
});
