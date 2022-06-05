const orderState = {
    FAILED: "FAIL", //Independent
    CANCELED: "CANCEL", //Independent
    TRANSIT: "IN_TRANSIT", //On processing complete
    VERFYING: "IN_VERIFY", //Default
    COMPLETED: "COMPLETED", //On transit complete
    PROCESSING: "IN_PROCESS", //On verified complete
};

export default orderState;