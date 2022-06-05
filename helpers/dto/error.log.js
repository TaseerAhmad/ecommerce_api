export default class ErrorLog {
    constructor(fileName, time, func, catchedErr) {
        this.fileName = fileName;
        this.time = time;
        this.func = func;
        this.catchedErr = catchedErr;
    }
}