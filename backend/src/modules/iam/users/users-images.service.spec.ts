import { UsersService } from './users.service';

describe('UsersService avatar storage', () => {
  const oldId = 'bus-booking/avatars/old';
  const image = {
    url: 'https://res.cloudinary.com/demo/image/upload/new.jpg',
    publicId: 'bus-booking/avatars/new',
  };
  let repo: any;
  let manager: any;
  let images: any;
  let service: UsersService;

  beforeEach(() => {
    manager = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'user', avatarPublicId: oldId }),
      save: jest
        .fn()
        .mockImplementation((_entity, user) => Promise.resolve(user)),
    };
    repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'user' }),
      manager: {
        transaction: jest.fn().mockImplementation((fn) => fn(manager)),
      },
    };
    images = {
      uploadImage: jest.fn().mockResolvedValue(image),
      cleanupImage: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(repo, images);
  });

  it('stores the URL and public ID before cleaning up the previous avatar', async () => {
    const result = await service.uploadAvatar(
      'user',
      {} as Express.Multer.File,
    );
    expect(result).toMatchObject({
      avatarUrl: image.url,
      avatarPublicId: image.publicId,
    });
    expect(manager.findOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(images.cleanupImage).toHaveBeenCalledWith(oldId);
    expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
      images.cleanupImage.mock.invocationCallOrder[0],
    );
  });

  it('removes the new upload and preserves the old image when the DB transaction fails', async () => {
    repo.manager.transaction.mockRejectedValue(new Error('DB unavailable'));
    await expect(
      service.uploadAvatar('user', {} as Express.Multer.File),
    ).rejects.toThrow('DB unavailable');
    expect(images.cleanupImage).toHaveBeenCalledWith(image.publicId);
    expect(images.cleanupImage).not.toHaveBeenCalledWith(oldId);
  });

  it('does not upload for a missing user', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.uploadAvatar('missing')).rejects.toThrow(
      'User not found',
    );
    expect(images.uploadImage).not.toHaveBeenCalled();
  });

  it('preserves the current avatar when Cloudinary rejects an upload', async () => {
    images.uploadImage.mockRejectedValue(new Error('Upload failed'));
    await expect(service.uploadAvatar('user')).rejects.toThrow('Upload failed');
    expect(repo.manager.transaction).not.toHaveBeenCalled();
    expect(images.cleanupImage).not.toHaveBeenCalled();
  });
});
