(function ($) {
    "use strict";

    /**
     * The datepicker constructor
     *
     * @class
     * @constructor
     * @param {HTMLElement} element
     * @param {object} options
     */
    var Datepicker = function (element, options) {
        /**
         * The element that the datepicker is bound to
         *
         * @member {*|HTMLElement}
         */
        this.$element = $(element);

        /**
         * The options from defaults and user-provided
         *
         * @type {object}
         */
        this.options = $.extend({}, $.fn.datepicker.defaults, options);

        /**
         * The selected date
         *
         * Defaults to today if none is provided
         *
         * @type {Date}
         */
        this.selectedDate = null;

        // allow the selected date to override any restrictions
        // otherwise, pick the start date, and if not provided, pick today
        if (this.options.selectedDate) {
            this.selectedDate = this.options.selectedDate;
        } else {
            if (this.options.startDate && this.options.startDate > 0) {
                this.selectedDate = this.options.startDate;
            } else {
                this.selectedDate = new Date();
            }
        }

        /**
         * The active year
         *
         * Separated out to keep track in case the DOM gets destroyed (popover)
         *
         * @type {number}
         */
        this.activeYear = this.selectedDate.getYear();

        /**
         * The active month
         *
         * Separated out to keep track in case the DOM gets destroyed (popover)
         *
         * @type {number}
         */
        this.activeMonth = this.selectedDate.getMonth();

        /**
         * The view mode which is either month, year, or decade
         *
         * Use Datepicker.VIEW_MODE_*
         *
         * @type {string}
         */
        this.viewMode = null;

        // validate and set locale shortcut
        if (!$.fn.datepicker.locale[this.options.locale]) {
            throw new Error('Invalid locale, no settings found for `' + this.options.locale + '`');
        }

        /**
         * Shortcut to the active locale
         *
         * @type {object}
         */
        this.locale = $.fn.datepicker.locale[this.options.locale];

        /**
         * Whether the datepicker is inline or not
         *
         * @type {boolean}
         */
        this.inline = false;

        /**
         * The root of the datepicker table
         *
         * @type {*|HTMLElement}
         */
        this.$datepicker = $($.fn.datepicker.template);

        // if we're attaching the table to an input, wrap the datapicker in a popover, and use that
        // otherwise, just build it and put it in the container
        if (this.$element.is('input') || this.$element.hasClass('input-group')) {
            // if we're appending it to an input, we'll put it in a bootstrap popover, check that we have it available
            if (!$.fn.popover) {
                throw new Error('Datepicker requires bootstrap/popover.js');
            }

            // setup the popover to show up next to the target element
            this.$element.popover($.extend({}, this.options.popover, {
                content: this.$datepicker,
                html: true
            }));

            // make sure that the listeners are attached
            var me = this;

            // Bootstrap destroys the previous content, which removes the listeners we had previously set up
            // When the `shown` event is fired by the popover, we check if the stuff we had added is still there,
            // adding it if not.
            this.$element.on('shown.bs.popover', function(e) {
                if (typeof $._data(me.$viewModeButton[0], 'events') === 'undefined') {
                    me._attachListeners();
                }
            });

            this.inline = false;
        } else {
            this.$datepicker.appendTo(this.$element);
            this.inline = true;
        }

        /**
         * The today button
         *
         * @type {*|HTMLElement}
         */
        this.$todayButton = this.$datepicker.find('.btn-today');

        /**
         * The view mode button
         *
         * @type {*|HTMLElement}
         */
        this.$viewModeButton = this.$datepicker.find('.btn-viewmode');

        /**
         * The previous button
         *
         * @type {*|HTMLElement}
         */
        this.$previousButton = this.$datepicker.find('.btn-previous');

        /**
         * The next button
         *
         * @type {*|HTMLElement}
         */
        this.$nextButton = this.$datepicker.find('.btn-next');

        /**
         * The datepicker table body
         *
         * @type {*|HTMLElement}
         */
        this.$body = this.$datepicker.find('tbody');

        // attach listeners for the buttons in the datepicker
        this._attachListeners();

        // set up the today button
        if (!this.options.todayButton) {
            this.$todayButton.hide();
        } else {
            this.$todayButton.text(this.locale.today);
        }

        // have the datepicker show itself
        this._setViewMode(this.options.viewMode);
    };

    /**
     * The datepicker prototype
     *
     * @type {object}
     */
    Datepicker.prototype = {
        /**
         * The constructor for the datepicker
         */
        constructor: Datepicker,

        // selection mode constants
        SELECTION_MODE_DAY: 'day',
//        SELECTION_MODE_WORK_WEEK: 'work_week',
//        SELECTION_MODE_WEEK: 'week',

        // view mode constants
        VIEW_MODE_MONTH: 'month',
        VIEW_MODE_YEAR: 'year',
        VIEW_MODE_DECADE: 'decade',

        /**
         * Gets the currently selected date in the picker
         *
         * @returns {Date}
         */
        getDate: function() {
            return this.selectedDate;
        },

        /**
         * Sets the currently selected date in the picker
         *
         * <strong>Resets view to month-view of the selected day.</strong>
         *
         * @param {Date} date
         */
        setDate: function(date) {
            if (date instanceof Date === false) {
                throw new Error("`date` passed to `setDate()` must be an instance of `Date`");
            }

            this.selectedDate = date;
            this._setViewMode(this.VIEW_MODE_MONTH, date.getFullYear(), date.getMonth());
            this.$body.find('.selected').focus();
        },

        /**
         * Shows the datepicker
         */
        show: function() {
            if (this.inline) {
                this.$datepicker.show();
            } else {
                this.$element.popover('show');
            }
        },

        /**
         * Hides the datepicker
         */
        hide: function() {
            if (this.inline) {
                this.$datepicker.hide();
            } else {
                this.$element.popover('hide');
            }
        },

        /**
         * Removes the datepicker from the element
         */
        destroy: function() {
            this.hide().$element.off('.datepicker').removeData('tm.datepicker');
        },

        /**
         * Attaches the listeners to the buttons within the datepicker
         *
         * @private
         */
        _attachListeners: function() {
            var me = this;

            /*
             * On change viewmode:
             * - show months if in month view (currently showing days)
             * - show years if in year view (currently showing months)
             */
            this.$viewModeButton.on('click', function() {
                var $this = $(this);

                // don't do anything if the view mode is disabled
                if ($this.hasClass('disabled')) {
                    return;
                }

                switch (me.viewMode) {
                    case me.VIEW_MODE_MONTH:
                        me._setViewMode(me.VIEW_MODE_YEAR, me.activeYear);
                        break;

                    case me.VIEW_MODE_YEAR:
                        me._setViewMode(me.VIEW_MODE_DECADE, me.activeYear);
                        break;
                }
            });

            /*
             * On click body cells
             * - select a year if in decade view (currently showing years)
             * - select a month if in year view (currently showing months)
             * - select a day if in month view (currently showing days)
             */
            this.$body.on('click', 'td', function() {
                var $this = $(this);
                if (me.$datepicker.hasClass('decade')) {
                    me.activeYear = $this.data('year');
                    me._setViewMode(me.VIEW_MODE_YEAR, me.activeYear);
                } else if (me.$datepicker.hasClass('year')) {
                    me.activeMonth = $this.data('month');
                    me._setViewMode(me.VIEW_MODE_MONTH, me.activeYear, me.activeMonth);
                } else {
                    // disallow clicks on disabled dates
                    if ($this.hasClass('disabled')) {
                        return;
                    }

                    // grab stuff to compare
                    var currMonth = me.selectedDate.getMonth();
                    var month = $this.data('month');

                    // set the internal selected ate
                    me.selectedDate = new Date($this.data('year'), $this.data('month'), $this.data('date'));

                    // if we're going forward or back a month, redraw the body
                    // otherwise, make sure no <td>'s are selected, the select the appropriate day (no redraw needed)
                    if (currMonth != month) {
                        var year = me.selectedDate.getFullYear();
                        if (currMonth == 11 && month == 0) {
                            year += 1;
                        } else if (currMonth == 0 && month == 11) {
                            year -= 1;
                        }
                        me._setViewMode(me.VIEW_MODE_MONTH, year, month);
                    } else {
                        me.$body.find('td').removeClass('selected');
                        $this.addClass('selected');
                    }

                    if (!me.inline) {
                        if (me.$element.hasClass('input-group')) {
                            me.$element.children('input.datepicker').val(me.options.format(me.selectedDate));
                        } else {
                            me.$element.val(me.options.format(me.selectedDate));
                        }

                        if (me.options.autoclose) {
                            me.hide();
                        }
                    }
                }
            });

            /*
             * On arrow press (keyboard nav)
             */
            if (this.options.keyboard) {
                this.$body.on('keydown', 'td', function(e) {
                    if (me.$datepicker.hasClass('month')) {
                        e.preventDefault();
                        var $selected = me.$body.find('.selected');
                        var diff = 0;
                        switch (e.which) {
                            case 37: // left
                                diff = me.locale.rtl ? 1 : -1;
                                break;

                            case 38: // up
                                diff = -7;
                                break;

                            case 39: // right
                                diff = me.locale.rtl ? -1 : 1;
                                break;

                            case 40: // down
                                diff = 7;
                                break;
                        }

                        var intMax = 9007199254740992;
                        var testMillis = me.selectedDate.getTime() + (diff * 86400000);
                        var startMillis = me.options.startDate == -Infinity ? -intMax : me.options.startDate.getTime();
                        var endMillis = me.options.endDate == Infinity ? intMax : me.options.endDate.getTime();
                        if (testMillis >= startMillis && testMillis <= endMillis) {
                            me.selectedDate.setDate(me.selectedDate.getDate() + diff);
                            me.setDate(me.selectedDate);
                        }
                    }
                });
            }

            /*
             * On click previous button
             * - go to previous decade if showing years
             * - go to previous year if showing months
             * - go to previous month if showing days
             */
            this.$previousButton.on('click', function() {
                switch (me.viewMode) {
                    case me.VIEW_MODE_DECADE:
                        me._setViewMode(me.VIEW_MODE_DECADE, me.activeYear - 6);
                        break;

                    case me.VIEW_MODE_YEAR:
                        me._setViewMode(me.VIEW_MODE_YEAR, me.activeYear - 1);
                        break;

                    case me.VIEW_MODE_MONTH:
                        var month = me.activeMonth;
                        var year = me.activeYear;
                        // back up the year if necessary
                        if (month == 0) {
                            month = 11;
                            year -= 1;
                        } else {
                            month -= 1;
                        }
                        me._setViewMode(me.VIEW_MODE_MONTH, year, month);
                        break;
                }
            });

            /*
             * On click next button
             * - go to next decade if showing years
             * - go to next year if showing months
             * - go to next month if showing days
             */
            this.$nextButton.on('click', function() {
                switch (me.viewMode) {
                    case me.VIEW_MODE_DECADE:
                        me._setViewMode(me.VIEW_MODE_DECADE, me.activeYear + 6);
                        break;

                    case me.VIEW_MODE_YEAR:
                        me._setViewMode(me.VIEW_MODE_YEAR, me.activeYear + 1);
                        break;

                    case me.VIEW_MODE_MONTH:
                        var month = me.activeMonth;
                        var year = me.activeYear;
                        // move the year forward if necessary
                        if (month == 11) {
                            month = 0;
                            year += 1;
                        } else {
                            month += 1;
                        }
                        me._setViewMode(me.VIEW_MODE_MONTH, year, month);
                        break;
                }
            });

            /*
             * Select today, and redraw the body
             */
            this.$todayButton.on('click', function() {
                me.selectedDate = new Date();
                me._setViewMode(me.VIEW_MODE_MONTH);
            });
        },

        /**
         * Hides the week header when viewing a year / decade
         *
         * @private
         */
        _hideWeekHeader: function() {
            var $weekHeader = this.$datepicker.find('.week');
            if ($weekHeader.length > 0) {
                $weekHeader.css('display', 'none');
            }
        },

        /**
         * Resets the colspan for the viewmode and today button.
         *
         * @param {int} totalColumns The total columns
         * @private
         */
        _setColspans: function(totalColumns) {
            // viewmode is -2, because of next and previous
            this.$viewModeButton.attr('colspan', totalColumns - 2);
            this.$todayButton.attr('colspan', totalColumns);
        },

        /**
         * Sets the view mode to the requested view
         *
         * Checks validity of the view mode before showing it
         *
         * @param {string} viewMode The view to show
         * @param {int} year The year to show
         * @param {int} month The month (0-based) to show
         * @private
         */
        _setViewMode: function(viewMode, year, month) {
            if (viewMode != this.VIEW_MODE_MONTH &&
                viewMode != this.VIEW_MODE_YEAR &&
                viewMode != this.VIEW_MODE_DECADE) {
                throw new Error("`viewMode` passed to `_setViewMode()` must be one of `Datepicker.VIEW_MODE_*`");
            }

            this.$body.empty();
            // remove class if it was previously added--will get figured in separate methods
            this.$viewModeButton.removeClass('disabled');
            if (year) {
                this.activeYear = year;
            }
            switch (viewMode) {
                case this.VIEW_MODE_MONTH:
                    this._showMonth(year, month);
                    break;

                case this.VIEW_MODE_YEAR:
                    this._showYear(year);
                    break;

                case this.VIEW_MODE_DECADE:
                    this._showDecade(year);
                    break;
            }

            // if we're over a field, redraw the popover in a proper place, but only if we're switching to/from month
            if (!this.inline && this.viewMode !== null) {
                this.$element.popover('show');
            }

            this.viewMode = viewMode;
        },

        /**
         * Shows the decade view
         *
         * Will go xxx0-xxx9, with the previous xxx9 and next xxx0 showing.
         *
         * @param {int} year The year to show the decade around.
         * @private
         */
        _showDecade: function(year) {
            year = year || this.selectedDate.getFullYear();

            // update the datepicker css class and the view mode button text
            var decadeStart = year - parseInt(year.toString()[3]);
            var decadeEnd = decadeStart + 9;
            this.$datepicker.removeClass('month').removeClass('year').addClass('decade');
            this.$viewModeButton.text(decadeStart + ' - ' + decadeEnd);
            this.$viewModeButton.addClass('disabled');
            this.activeYear = decadeStart + 5;

            this._hideWeekHeader();
            this._setColspans(8);

            // go through each row (3 rows)
            var yearNo = decadeStart - 1;
            for (var i = 0; i < 3; i++) {
                // go through each cell (4 cells). Using the array for easy RTL support
                var years = [];
                for (var j = 0; j < 4; j++) {
                    var cls = '';
                    // the selected date is in the current year
                    if (yearNo == this.selectedDate.getFullYear()) {
                        cls += 'selected ';
                    }
                    // the xxx9 of the previous decade, and xxx0 of the next decade should be inactive
                    if ((i == 0 && j == 0) || (i == 2 && j == 3)) {
                        cls += 'inactive';
                    }

                    // add years and go forth
                    years.push('<td colspan="2" class="' + cls + '" data-year="' + yearNo + '">' + yearNo + '</td>');
                    yearNo++;
                }

                if (this.locale.rtl) {
                    years.reverse();
                }

                this.$body.append('<tr>' + years.join('') + '</tr>');
            }
        },

        /**
         * Shows the days in a month
         *
         * @param {int} year The year to show the month in
         * @param {int} month The number of the month (0-based)
         * @private
         */
        _showMonth: function(year, month) {
            year = year || this.selectedDate.getFullYear();
            month = month > -1 ? month : this.selectedDate.getMonth();

            // update the datepicker css class and the view mode button text
            this.$datepicker.removeClass('year').removeClass('decade').addClass('month');
            this.$viewModeButton.text(this.locale.months[month] + ' ' + year);
            this.activeYear = year;
            this.activeMonth = month;

            if ($.inArray(this.VIEW_MODE_YEAR, this.options.viewModes) == -1) {
                this.$viewModeButton.addClass('disabled');
            }

            // adding the day names to the header, building if necessary
            var $weekHeader = this.$datepicker.find('.week');
            if ($weekHeader.length == 0) {
                /*
                 * Go through the shortest day texts, starting from the selected week start. If the week start is not
                 * 0, we'll need to get anything before the week start and append that to the array.
                 *
                 * This can be reversed in the case of RTL
                 *
                 * e.g.
                 * weekStart = 3
                 * headers = [
                 *  WEEKNUM
                 *  We
                 *  Th
                 *  Fr
                 *  Sa
                 *  Su
                 *  Mo
                 *  Tu
                 * ];
                 */
                // only show week numbers if we're asked
                var headers = this.options.weekNumbers ? ['<th class="weeknumber">&nbsp;</th>'] : [];
                for (var i = this.options.weekStart; i < 7; i++) {
                    headers.push('<th>' + this.locale.daysMin[i] + '</th>');
                }

                if (this.options.weekStart > 0) {
                    for (var j = 0; j < this.options.weekStart; j++) {
                        headers.push('<th>' + this.locale.daysMin[j] + '</th>');
                    }
                }

                if (this.locale.rtl) {
                    headers.reverse();
                }

                this.$datepicker.find('thead').append('<tr class="week">' + headers.join('') + '</tr>');
            } else {
                $weekHeader.css('display', '');
            }

            /*
             * Setting up a few things for the calendar:
             *
             * oneJan - for calculating week numbers
             * monthInc - the `Date` we use to go from start to finish to draw the dates in the current view
             * firstDay - the day number [0-6] of the first day of the month
             * firstDate - always 1, but it's expressive :) (first of the month, so...1)
             */
            var oneJan = new Date(year, 0, 1);
            var monthInc = new Date(year, month, 1);
            var firstDay = monthInc.getDay();
            var firstDate = monthInc.getDate();

            /*
             * if the first day is after the week start, we back up to whatever day in the previous month that would start the week
             * else if the first day is the start of the week, we back up 1 week to have dates for the user to click on
             * otherwise, we back up a full week, plus whatever day, then substract the weekstart
             * this works out, I swear!
             */
            if (firstDay > this.options.weekStart) {
                monthInc.setDate(firstDate - (firstDay - this.options.weekStart));
            } else if (firstDay == this.options.weekStart) {
                monthInc.setDate(firstDate - 7);
            } else {
                monthInc.setDate(firstDate - ((7 + firstDay) - this.options.weekStart));
            }

            // utility function for reusability
            // doing nasty things with loose scoping, but I'm feeling honey badgerish.
            var me = this;
            var today = new Date();
            var addDayCell = function() {
                var cls = '';
                if (monthInc.getMonth() != month) {
                    cls += 'inactive ';
                }
                if (monthInc.getFullYear() == today.getFullYear() &&
                    monthInc.getMonth() == today.getMonth() &&
                    monthInc.getDate() == today.getDate()) {
                    cls += 'today ';
                }
                if (monthInc.getFullYear() == me.selectedDate.getFullYear() &&
                    monthInc.getMonth() == me.selectedDate.getMonth() &&
                    monthInc.getDate() == me.selectedDate.getDate()) {
                    cls += 'selected ';
                }
                // calculate disabled days; these can be explicitly defined, or based off start|end date
                // Also, if the day is before or after the start or end date respectively, disable them
                if ($.inArray(monthInc.getDay(), me.options.disabledDays) > -1 ||
                    (
                        typeof me.options.startDate == 'object' &&
                        (
                            // ANYTHING prior to the disabled month is disabled
                            (me.options.startDate.getFullYear() >= monthInc.getFullYear() &&
                            me.options.startDate.getMonth() > monthInc.getMonth()) ||

                            // ALL days prior to the selected day in the current month is disabled
                            (me.options.startDate.getFullYear() == monthInc.getFullYear() &&
                            me.options.startDate.getMonth() == monthInc.getMonth() &&
                            me.options.startDate.getDate() > monthInc.getDate())
                        )
                    ) ||
                    (
                        typeof me.options.endDate == 'object' &&
                        (
                            // ANYTHING following the disabled month is disabled
                            (me.options.endDate.getFullYear() <= monthInc.getFullYear() &&
                            me.options.endDate.getMonth() < monthInc.getMonth()) ||

                            // ALL days following the selected day in the current month is disabled
                            (me.options.endDate.getFullYear() == monthInc.getFullYear() &&
                            me.options.endDate.getMonth() == monthInc.getMonth() &&
                            me.options.endDate.getDate() < monthInc.getDate())
                        )
                    )) {
                    cls += 'disabled ';
                }
                var date = monthInc.getDate();
                dates.push('<td class="' + cls + '" data-year="' + year + '" data-month="' + monthInc.getMonth() + '" data-date="' + date + '">' + date + '</td>');
                monthInc.setDate(monthInc.getDate() + 1);
            };

            // go through each row (6 rows). This verifies that there'll be dates in the next/prev month for the user to click
            for (var i = 0; i < 6; i++) {
                // from: http://stackoverflow.com/questions/7765767/show-week-number-with-javascript
                var weekNo = Math.ceil((((monthInc - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);

                // only show week numbers if we're asked
                var dates = this.options.weekNumbers ? ['<td class="weeknumber">' + weekNo + '</td>'] : [];

                // same as headers, go from week start to the end of the week, then go back and get from 0 to week start
                for (var j = this.options.weekStart; j < 7; j++) {
                    addDayCell();
                }

                if (this.options.weekStart > 0) {
                    for (var k = 0; k < this.options.weekStart; k++) {
                        addDayCell();
                    }
                }

                if (this.locale.rtl) {
                    dates.reverse();
                }

                this.$body.append('<tr>' + dates.join('') + '</tr>');
            }

            this.$body.find('td').attr('tabindex', '-1');

            // only make it 8 cols if we're showing week numbers
            if (this.options.weekNumbers) {
                this._setColspans(8);
            } else {
                this._setColspans(7);
            }
        },

        /**
         * Shows the months in a year
         *
         * @param {int} year The year to show months for
         * @private
         */
        _showYear: function(year) {
            year = year || this.selectedDate.getFullYear();

            // update the datepicker css class and the view mode button text
            this.$datepicker.removeClass('month').removeClass('decade').addClass('year');
            this.$viewModeButton.text(year);
            this.activeYear = year;

            if ($.inArray(this.VIEW_MODE_DECADE, this.options.viewModes) == -1) {
                this.$viewModeButton.addClass('disabled');
            }

            this._hideWeekHeader();
            this._setColspans(8);

            // go through each row (3 rows)
            var month = this.selectedDate.getMonth();
            for (var i = 0; i < 3; i++) {
                // go through each cell (4 cells). Using the array for easy RTL support
                var months = [];
                for (var j = 0; j < 4; j++) {
                    // combine inner and outer loop to get the accurate month index
                    var monthIndex = j + (i * 4);
                    var cls = '';
                    // if the currently selected date is in the month, and the year is this year, make it selected
                    if (month == monthIndex && year == this.selectedDate.getFullYear()) {
                        cls += 'selected';
                    }

                    // get the text and add it
                    var monthName = this.locale.monthsShort[monthIndex];
                    months.push('<td colspan="2" class="' + cls + '" data-year="' + year + '" data-month="' + monthIndex + '">' + monthName + '</td>');
                }

                if (this.locale.rtl) {
                    months.reverse();
                }

                this.$body.append('<tr>' + months.join('') + '</tr>');
            }
        }
    };

    var old = $.fn.datepicker;
    $.fn.datepicker = function(option, args) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('tm.datepicker');
            var options = typeof option === 'object' && option;

            if (!data) {
                $this.data('tm.datepicker', (data = new Datepicker(this, options)));
            }

            if (typeof option === 'string' && typeof data[option] === 'function') {
                data[option](args);
            }
        });
    };

    $.fn.datepicker.constructor = Datepicker;

    $.fn.datepicker.noConflict = function () {
        $.fn.datepicker = old;
        return this;
    }

    $.fn.datepicker.defaults = {
        autoclose: true,
        disabledDays: [],
        endDate: Infinity,
        format: function(date) {
            return date.toLocaleDateString();
        },
        highlightToday: true,
        keyboard: true,
        locale: 'en',
        popover: {
            animation: false,
            placement: 'auto',
            template: '<div class="popover datepicker-popover"><div class="arrow"></div><div class="popover-content"></div></div>'
        },
        selectedDate: null,
        selectionMode: 'day',
        startDate: -Infinity,
        todayButton: true,
        viewMode: 'month',
        viewModes: ['month', 'year', 'decade'],
        weekNumbers: false,
        weekStart: 0
    };

    $.fn.datepicker.template =
        '<table class="datepicker">' +
            '<thead>' +
                '<tr>' +
                    '<th class="btn-previous"><span class="glyphicon glyphicon-chevron-left"></span></th>' +
                    '<th colspan="6" class="btn-viewmode"></th>' +
                    '<th class="btn-next"><span class="glyphicon glyphicon-chevron-right"></span></th>' +
                '</tr>' +
            '</thead>' +
            '<tbody></tbody>' +
            '<tfoot>' +
                '<tr>' +
                    '<th colspan="8" class="btn-today"></th>' +
                '</tr>' +
            '</tfoot>' +
        '</table>';

    $.fn.datepicker.locale = {
        en: {
            days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
            daysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            daysMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"],
            months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
            today: "Today",
            clear: "Clear",
            workWeek: [1, 2, 3, 4, 5]
        }
    }
}(window.jQuery));