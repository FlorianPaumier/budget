export default class HealthController {
  async show() {
    return { data: { status: 'ok' } }
  }
}
