export default class GenericResponse {
  constructor(statusCode, message, responseData) {
    this.message = message;
    this.statusCode = statusCode;
    this.responseData = responseData;
  }
}
