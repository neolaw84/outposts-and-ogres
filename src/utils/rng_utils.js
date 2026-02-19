const RPMGL_RNG = {
    random: function () {
        return Math.random();
    },

    randomInt: function (min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    rollxdy: function (x, y) {
        if (typeof x === 'undefined') x = 3;
        if (typeof y === 'undefined') y = 6;

        let total = 0;
        for (let i = 0; i < x; i++) {
            total += this.randomInt(1, y);
        }
        return total;
    }
};


if (typeof module !== 'undefined') module.exports = RPMGL_RNG;
