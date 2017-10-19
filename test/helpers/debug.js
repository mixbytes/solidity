export const l = console.log;

export function logEvents(instance) {
    instance.allEvents(function(error, log){
        if (!error)
            console.log(log);
    });
}
