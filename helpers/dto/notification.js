export default class Notification {
    constructor(type, header, text, recieverId) {
        this.type = type;
        this.text = text;
        this.header = header;
        this.recieverId = recieverId;
    }
}
