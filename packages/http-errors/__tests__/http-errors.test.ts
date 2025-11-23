import {
  HTTPError,
  NotFoundError,
  BadRequestError,
  InternalServerError,
  createHTTPError
} from '../src';

describe('http-errors', () => {
  it('should create a NotFoundError with correct properties', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(HTTPError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found | Status: 404');
    expect(error.name).toBe('NotFoundError');
  });

  it('should create a BadRequestError with correct properties', () => {
    const error = new BadRequestError();

    expect(error.status).toBe(400);
    expect(error.message).toBe('Bad Request | Status: 400');
  });

  it('should create an InternalServerError with correct properties', () => {
    const error = new InternalServerError();

    expect(error.status).toBe(500);
    expect(error.message).toBe('Internal Server Error | Status: 500');
  });

  it('should create errors using createHTTPError', () => {
    const notFoundError = createHTTPError(404);
    expect(notFoundError).toBeInstanceOf(NotFoundError);
    expect(notFoundError.status).toBe(404);

    const badRequestError = createHTTPError(400);
    expect(badRequestError).toBeInstanceOf(BadRequestError);
    expect(badRequestError.status).toBe(400);
  });

  it('should create a generic HTTPError for unknown status codes', () => {
    const error = createHTTPError(999);

    expect(error).toBeInstanceOf(HTTPError);
    expect(error.status).toBe(999);
    expect(error.message).toBe('Unknown Error | Status: 999');
  });
});
