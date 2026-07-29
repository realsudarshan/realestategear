export class PortalConfigError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
    this.name = 'PortalConfigError';
  }
}
