const TimeUtils = {
    parseDuration: function (durationStr) {
        const regex = /P(?:([0-9]+)Y)?(?:([0-9]+)M)?(?:([0-9]+)W)?(?:([0-9]+)D)?(?:T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?)?/;
        const matches = durationStr.match(regex);

        if (!matches) return 0;

        const years = parseInt(matches[1] || 0);
        const months = parseInt(matches[2] || 0);
        const weeks = parseInt(matches[3] || 0);
        const days = parseInt(matches[4] || 0);
        const hours = parseInt(matches[5] || 0);
        const minutes = parseInt(matches[6] || 0);
        const seconds = parseInt(matches[7] || 0);

        let ms = 0;
        ms += seconds * 1000;
        ms += minutes * 60 * 1000;
        ms += hours * 60 * 60 * 1000;
        ms += days * 24 * 60 * 60 * 1000;
        ms += weeks * 7 * 24 * 60 * 60 * 1000;
        ms += months * 30 * 24 * 60 * 60 * 1000;
        ms += years * 365 * 24 * 60 * 60 * 1000;

        return ms;
    },

    addDuration: function (dateStr, duration) {
        const date = new Date(dateStr);
        let msToAdd = 0;

        if (typeof duration === 'string') {
            msToAdd = this.parseDuration(duration);
        } else {
            msToAdd = duration;
        }

        const newTime = date.getTime() + msToAdd;
        return new Date(newTime).toISOString().split('.')[0];
    },

    isPast: function (dateStr, referenceDateStr) {
        const date = new Date(dateStr);
        const refDate = new Date(referenceDateStr);
        return date < refDate;
    },

    // Check if valid "yyyy-mm-ddTHH:MM:SS" format
    isValidDateStr: function (dateStr) {
        const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
        if (!regex.test(dateStr)) return false;
        const date = new Date(dateStr);
        return !isNaN(date.getTime());
    },

    // Check if valid ISO 8601 duration format (e.g., PT1H30M, P1DT2H, PT5S)
    isValidDurationStr: function (durationStr) {
        // ISO 8601 duration: P[n]Y[n]M[n]DT[n]H[n]M[n]S
        // P is required, T separates date and time components
        const regex = /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
        if (!regex.test(durationStr)) return false;
        // Additional check: must have at least one time component after P
        return durationStr.length > 1 && durationStr !== 'PT';
    },

    // Format Date object to "yyyy-mm-ddTHH:MM:SS"
    formatDate: function (date) {
        const pad = function (num) { return (num < 10 ? '0' : '') + num; };
        return date.getFullYear() +
            '-' + pad(date.getMonth() + 1) +
            '-' + pad(date.getDate()) +
            'T' + pad(date.getHours()) +
            ':' + pad(date.getMinutes()) +
            ':' + pad(date.getSeconds());
    },

    // Format Date object or string to "yyyy-mm-ddTHH:MM:SS AM/PM"
    formatDate12Hr: function (date) {
        const pad = function (num) { return (num < 10 ? '0' : '') + num; };
        const d = (typeof date === 'string') ? new Date(date) : date;
        let hours = d.getHours();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        return d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            'T' + pad(hours) +
            ':' + pad(d.getMinutes()) +
            ':' + pad(d.getSeconds()) +
            ' ' + ampm;
    },

    getDow: function (date) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const d = (typeof date === 'string') ? new Date(date) : date;
        return days[d.getDay()];
    },


    /**
     * Clamps a timestamp between optional minimum and maximum bounds
     * @param {string|null} minTime - Minimum allowed timestamp (null means no lower bound)
     * @param {string|null} maxTime - Maximum allowed timestamp (null means no upper bound)
     * @param {string} inputTime - The timestamp to clamp (must be a valid datetime string)
     * @returns {string} - Clamped timestamp
     */
    clampTime: function (minTime, maxTime, inputTime) {
        // Clamp to maxTime if inputTime is later
        if (maxTime !== null && inputTime > maxTime) {
            return maxTime;
        }

        // Clamp to minTime if inputTime is earlier
        if (minTime !== null && inputTime < minTime) {
            return minTime;
        }

        // Otherwise return as-is
        return inputTime;
    },

    getMidnightsPassed: function (oldTime, newTime) {
        const oldMs = Date.parse(oldTime);
        const newMs = Date.parse(newTime);
        const oldDays = Math.floor(oldMs / 86400000);
        const newDays = Math.floor(newMs / 86400000);
        return newDays - oldDays;
    }
};


if (typeof module !== 'undefined') module.exports = TimeUtils;
