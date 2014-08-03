// Written by Jürgen Moßgraber - mossgrabers.de
//            Michael Schmalle - teotigraphix.com
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

function BaseView (model)
{
    this.model = model;

    this.canScrollLeft  = true;
    this.canScrollRight = true;
    this.canScrollUp    = true;
    this.canScrollDown  = true;

    this.restartFlag   = false;
    this.stopPressed   = false;

    // override in subclass with specific Config value
    // TODO Eventually needs to listen to a config property change
    this.scrollerInterval = 100;

    this.scrollerLeft = new TimerTask (this, this.scrollLeft, this.scrollerInterval);
    this.scrollerRight = new TimerTask (this, this.scrollRight, this.scrollerInterval);
    this.scrollerUp = new TimerTask (this, this.scrollUp, this.scrollerInterval);
    this.scrollerDown = new TimerTask (this, this.scrollDown, this.scrollerInterval);
}
BaseView.prototype = new View ();
BaseView.prototype.constructor = BaseView;

BaseView.lastNoteView = VIEW_PLAY;

BaseView.prototype.onActivate = function ()
{
    this.updateNoteMapping ();
};

BaseView.prototype.updateDevice = function ()
{
    var m = this.push.getActiveMode ();
    if (m != null)
    {
        m.updateDisplay ();
        m.updateFirstRow ();
        m.updateSecondRow ();
    }
    this.updateButtons ();
    this.updateArrows ();
};

BaseView.prototype.onPitchbend = function (data1, data2)
{
    if (this.push.isShiftPressed ())
    {
        if (this.push.getCurrentMode () != MODE_RIBBON)
            this.push.setPendingMode (MODE_RIBBON);
        return;
    }

    switch (Config.ribbonMode)
    {
        case Config.RIBBON_MODE_PITCH:
            this.push.sendMidiEvent (0xE0, data1, data2);
            break;

        case Config.RIBBON_MODE_CC:
            if (data2 == 64)    // Overwrite automatic recentering on release
                data2 = 0;
            this.push.sendMidiEvent (0xB0, Config.ribbonModeCCVal, data2);
            break;

        case Config.RIBBON_MODE_MIXED:
            if (data2 > 64)
                this.push.sendMidiEvent (0xE0, data1, data2);
            else if (data2 < 64)
                this.push.sendMidiEvent (0xB0, Config.ribbonModeCCVal, 127 - data2 * 2);
            else
            {
                this.push.sendMidiEvent (0xE0, data1, data2);
                this.push.sendMidiEvent (0xB0, Config.ribbonModeCCVal, 0);
            }
            break;
    }
};

//--------------------------------------
// Group 1
//--------------------------------------

BaseView.prototype.onPlay = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isShiftPressed ())
        this.model.getTransport ().toggleLoop ();
    else
    {
        if (!this.restartFlag)
        {
            this.model.getTransport ().play ();
            this.doubleClickTest ();
        }
        else
        {
            this.model.getTransport ().stopAndRewind ();
            this.restartFlag = false;
        }
    }
};

BaseView.prototype.onRecord = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isShiftPressed ())
        this.model.getTransport ().toggleLauncherOverdub ();
    else
        this.model.getTransport ().record ();
};

BaseView.prototype.onNew = function (event)
{
    if (!event.isDown ())
        return;
    var tb = this.model.getTrackBank ();
    var t = tb.getSelectedTrack ();
    if (t != null)
    {
        var slotIndex = this.getSelectedSlot (t);
        if (slotIndex == -1)
            slotIndex = 0;
            
        for (var i = 0; i < 8; i++)
        {
            var sIndex = (slotIndex + i) % 8;
            var s = t.slots[sIndex];
            if (!s.hasContent)
            {
                var slots = tb.getClipLauncherSlots (t.index);
                slots.createEmptyClip (sIndex, Math.pow (2, tb.getNewClipLength ()));
                if (slotIndex != sIndex)
                    slots.select (sIndex);
                slots.launch (sIndex);
                this.model.getTransport ().setLauncherOverdub (true);
                return;
            }
        }
    }
    displayNotification ("In the current selected grid view there is no empty slot. Please scroll down.");
};

BaseView.prototype.onDuplicate = function (event)
{
    if (event.isDown ())
        this.model.getApplication ().doubleClip ();
};

BaseView.prototype.onAutomation = function (event)
{
    if (!event.isDown ())
        return;
    var selectedTrack = this.model.getTrackBank ().getSelectedTrack ();
    if (selectedTrack != null)
        this.model.getTransport ().toggleWriteArrangerAutomation ();
};

BaseView.prototype.onFixedLength = function (event)
{
    if (!event.isLong ())
        this.push.setPendingMode (event.isDown () ? MODE_FIXED : this.push.getPreviousMode ());
};

//--------------------------------------
// Group 2
//--------------------------------------

BaseView.prototype.onQuantize = function (event)
{
    if (!event.isDown ())
        return;

    if (this.push.isShiftPressed ())
        this.push.setPendingMode (MODE_GROOVE);
    else
        this.model.getApplication ().quantize ();
};

BaseView.prototype.onDouble = function (event)
{
    if (event.isDown ())
        this.model.getApplication ().duplicate ();
};

BaseView.prototype.onDelete = function (event)
{
    if (event.isDown ())
        this.model.getApplication ().deleteSelection ();
};

BaseView.prototype.onUndo = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isShiftPressed ())
        this.model.getApplication ().redo ();
    else
        this.model.getApplication ().undo ();
};

//--------------------------------------
// Group 3
//--------------------------------------

BaseView.prototype.onSmallKnob1 = function (increase)
{
    this.model.getTransport( ).changeTempo (increase);
};

BaseView.prototype.onSmallKnob1Touch = function (isTouched)
{
    this.model.getTransport ().setTempoIndication (isTouched);
};

// Change time (play position)
BaseView.prototype.onSmallKnob2 = function (increase)
{
    this.model.getTransport ().changePosition (increase, this.push.isShiftPressed ());
};

// BaseView.prototype.onSmallKnob2Touch = function (isTouched) {};

//--------------------------------------
// Group 4
//--------------------------------------

BaseView.prototype.onMetronome = function (event)
{
    if (event.isDown ())
        this.model.getTransport ().toggleClick ();
};

BaseView.prototype.onTapTempo = function (event)
{
    if (event.isDown ())
        this.model.getTransport ().tapTempo ();
};

//--------------------------------------
// Group 5
//--------------------------------------

BaseView.prototype.onValueKnob = function (index, value)
{
    var m = this.push.getActiveMode ();
    if (m != null)
        m.onValueKnob (index, value);
};

// BaseView.prototype.onValueKnobTouch = function (knob, isTouched) {};

BaseView.prototype.onValueKnob9 = function (value)
{
    this.model.getMasterTrack ().incVolume (value);
};

BaseView.prototype.onValueKnob9Touch = function (isTouched)
{
    if (isTouched && this.push.getCurrentMode () == MODE_MASTER)
        return;
    this.push.setPendingMode (isTouched ? MODE_MASTER : this.push.getPreviousMode ());
};

BaseView.prototype.onFirstRow = function (index)
{
    var m = this.push.getActiveMode ();
    if (m != null)
        m.onFirstRow (index);
};

BaseView.prototype.onSecondRow = function (index)
{
    var m = this.push.getActiveMode ();
    if (m != null)
        m.onSecondRow (index);
};

//--------------------------------------
// Group 6
//--------------------------------------

BaseView.prototype.onMaster = function (event)
{
    switch (event.getState ())
    {
        case ButtonEvent.UP:
            if (this.push.getCurrentMode () == MODE_FRAME)
                this.push.setPendingMode (this.push.getPreviousMode ());
            break;
        case ButtonEvent.DOWN:
            if (this.push.isActiveMode (MODE_MASTER))
                this.push.toggleVU ();
            else
            {
                this.push.setPendingMode (MODE_MASTER);
                this.model.getMasterTrack ().select ();
            }
            break;
        case ButtonEvent.LONG:
            // Toggle back since it was toggled on DOWN
            this.push.toggleVU ();
            this.push.setPendingMode (MODE_FRAME);
            break;
    }
};

BaseView.prototype.onStop = function (event)
{
    if (this.push.isShiftPressed ())
    {
        this.model.getTrackBank ().getClipLauncherScenes ().stop ();
        return;
    }
    this.stopPressed = event.isDown ();
    this.push.setButton (PUSH_BUTTON_STOP, this.stopPressed ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
};

// BaseView.prototype.onScene = function (index) {};

//--------------------------------------
// Group 7
//--------------------------------------

BaseView.prototype.onVolume = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isActiveMode (MODE_VOLUME))
        this.push.toggleVU ();
    else
        this.push.setPendingMode (MODE_VOLUME);
};

BaseView.prototype.onPanAndSend = function (event)
{
    if (!event.isDown ())
        return;
    var mode = this.push.getCurrentMode () + 1;
    if (mode < MODE_PAN || mode > MODE_SEND6)
        mode = MODE_PAN;
    this.push.setPendingMode (mode);
};

BaseView.prototype.onTrack = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isActiveMode (MODE_TRACK))
        this.push.toggleVU ();
    else
        this.push.setPendingMode (MODE_TRACK);
};

// BaseView.prototype.onClip = function (event) {};

BaseView.prototype.onDevice = function (event)
{
    if (!event.isDown ())
        return;
    var selectMode = this.push.getMode (MODE_PARAM_PAGE_SELECT);
    var cm = this.push.getCurrentMode ();
    if (cm == MODE_PARAM_PAGE_SELECT || !selectMode.isPageMode (cm))
        this.push.setPendingMode (selectMode.getCurrentMode ());
    else
        this.push.setPendingMode (MODE_PARAM_PAGE_SELECT);
};

BaseView.prototype.onBrowse = function (event)
{
    if (!event.isDown ())
        return;

    if (this.push.getCurrentMode () == MODE_BANK_DEVICE)
        this.push.setPendingMode (MODE_PRESET);
    else
        this.model.getApplication ().toggleBrowserVisibility (); // Track
};

//--------------------------------------
// Group 8
//--------------------------------------

BaseView.prototype.onDeviceLeft = function (event)
{
    if (!event.isDown ())
        return;

    var tb = this.model.getTrackBank ();
    if (tb.canScrollTracksUp ())
    {
        tb.scrollTracksPageUp ();
        scheduleTask (doObject (this, this.selectTrack), [7], 100);
    }
};

BaseView.prototype.onDeviceRight = function (event)
{
    if (!event.isDown ())
        return;

    var tb = this.model.getTrackBank ();
    if (tb.canScrollTracksDown ())
    {
        tb.scrollTracksPageDown ();
        scheduleTask (doObject (this, this.selectTrack), [0], 100);
    }
};

BaseView.prototype.onMute = function (event)
{
    this.model.getTrackBank ().setTrackState (TrackBankProxy.TrackState.MUTE);
};

BaseView.prototype.onSolo = function (event)
{
    this.model.getTrackBank ().setTrackState (TrackBankProxy.TrackState.SOLO);
};

BaseView.prototype.onScales = function (event)
{
    switch (event.getState ())
    {
        case ButtonEvent.DOWN:
            this.quitScalesMode = false;
            this.push.setPendingMode (this.push.getCurrentMode () == MODE_SCALES ? this.push.getPreviousMode () : MODE_SCALES);
            break;
        case ButtonEvent.LONG:
            this.quitScalesMode = true;
            break;
        case ButtonEvent.UP:
            if (this.quitScalesMode)
                this.push.setPendingMode (this.push.getPreviousMode ());
            break;
    }
};

// BaseView.prototype.onUser = function (event) {};

// BaseView.prototype.onRepeat = function (event) {};

BaseView.prototype.onAccent = function (event)
{
    switch (event.getState ())
    {
        case ButtonEvent.DOWN:
            this.quitAccentMode = false;
            break;
        case ButtonEvent.LONG:
            this.quitAccentMode = true;
            this.push.setPendingMode (MODE_ACCENT);
            break;
        case ButtonEvent.UP:
            if (this.quitAccentMode)
                this.push.setPendingMode (this.push.getPreviousMode ());
            else
            {
                Config.accentActive = !Config.accentActive;
                this.push.setButton (PUSH_BUTTON_ACCENT, Config.accentActive ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
            }
            break;
    }
};

// BaseView.prototype.onOctaveDown = function (event) {};

// BaseView.prototype.onOctaveUp = function (event) {};

//--------------------------------------
// Group 9
//--------------------------------------

BaseView.prototype.onAddEffect = function (event)
{
    if (event.isDown ())
        this.model.getApplication ().addEffect ();
};

BaseView.prototype.onAddTrack = function (event)
{
    if (event.isDown ())
        this.model.getApplication ().addTrack ();
};

BaseView.prototype.onNote = function (event)
{
    if (!event.isDown ())
        return;
    BaseView.lastNoteView = this.push.isActiveView (VIEW_SESSION) ? BaseView.lastNoteView :
                                (this.push.isShiftPressed () ? VIEW_DRUM : (this.push.isActiveView (VIEW_PLAY) ? VIEW_SEQUENCER : VIEW_PLAY));
    this.push.setActiveView (BaseView.lastNoteView);
};

BaseView.prototype.onSession = function (event)
{
    if (!event.isDown ())
        return;
    if (this.push.isActiveView (VIEW_SESSION))
        return;
    BaseView.lastNoteView = this.push.isActiveView (VIEW_PLAY) ? VIEW_PLAY : (this.push.isActiveView (VIEW_DRUM) ? VIEW_DRUM : VIEW_SEQUENCER);
    this.push.setActiveView (VIEW_SESSION);
};

// BaseView.prototype.onSelect = function (event) {};

BaseView.prototype.onShift = function (event)
{
    this.push.setButton (PUSH_BUTTON_SHIFT, event.isUp () ? PUSH_BUTTON_STATE_ON : PUSH_BUTTON_STATE_HI);
    
    var cm = this.push.getCurrentMode ();
    if (event.isDown () && cm == MODE_SCALES)
        this.push.setPendingMode (MODE_SCALE_LAYOUT);
    else if (event.isUp () && cm == MODE_SCALE_LAYOUT)
        this.push.setPendingMode (MODE_SCALES);
};

//--------------------------------------
// Group 10
//--------------------------------------

BaseView.prototype.onUp = function (event)
{
    if (event.isDown ())
    {
        this.scrollUp (event);
    }
    else if (event.isLong ())
    {
        this.scrollerUp.start ([event]);
    }
    else if (event.isUp ())
    {
        this.scrollerUp.stop ();
    }
};

BaseView.prototype.onDown = function (event)
{
    if (event.isDown ())
    {
        this.scrollDown (event);
    }
    else if (event.isLong ())
    {
        this.scrollerDown.start ([event]);
    }
    else if (event.isUp ())
    {
        this.scrollerDown.stop ();
    }
};

BaseView.prototype.onLeft = function (event)
{
    if (event.isDown ())
    {
        this.scrollLeft (event);
    }
    else if (event.isLong ())
    {
        this.scrollerLeft.start ([event]);
    }
    else if (event.isUp ())
    {
        this.scrollerLeft.stop ();
    }
};

BaseView.prototype.onRight = function (event)
{
    if (event.isDown ())
    {
        this.scrollRight (event);
    }
    else if (event.isLong ())
    {
        this.scrollerRight.start ([event]);
    }
    else if (event.isUp ())
    {
        this.scrollerRight.stop ();
    }
};

//--------------------------------------
// Group 11
//--------------------------------------

// BaseView.prototype.onFootswitch1 = function (value) {};

BaseView.prototype.onFootswitch2 = function (value)
{
    this.onNew (new ButtonEvent (value == 127 ? ButtonEvent.DOWN : ButtonEvent.UP));
};

//--------------------------------------
// Protected API
//--------------------------------------

// implemented for Arrow scrolling in subclass Views
BaseView.prototype.scrollUp = function (event) {};
BaseView.prototype.scrollDown = function (event) {};
BaseView.prototype.scrollLeft = function (event) {};
BaseView.prototype.scrollRight = function (event) {};

BaseView.prototype.selectTrack = function (index)
{
    this.model.getTrackBank ().select (index);
};

BaseView.prototype.updateButtons = function ()
{
    var tb = this.model.getTrackBank ();
    var isMuteState = tb.isMuteState ();
    this.push.setButton (PUSH_BUTTON_MUTE, isMuteState ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
    this.push.setButton (PUSH_BUTTON_SOLO, !isMuteState ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_ON);
};

BaseView.prototype.updateArrows = function ()
{
    this.push.setButton (PUSH_BUTTON_LEFT, this.canScrollLeft ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
    this.push.setButton (PUSH_BUTTON_RIGHT, this.canScrollRight ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
    this.push.setButton (PUSH_BUTTON_UP, this.canScrollUp ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
    this.push.setButton (PUSH_BUTTON_DOWN, this.canScrollDown ? PUSH_BUTTON_STATE_HI : PUSH_BUTTON_STATE_OFF);
};

BaseView.prototype.getSelectedSlot = function (track)
{
    for (var i = 0; i < track.slots.length; i++)
        if (track.slots[i].isSelected)
            return i;
    return -1;
};

BaseView.prototype.updateNoteMapping = function ()
{
    this.push.setKeyTranslationTable (initArray (-1, 128));
};

BaseView.prototype.turnOffBlink = function ()
{
    for (var i = 36; i < 100; i++)
        this.push.pads.blink (i, PUSH_COLOR_BLACK);
};

BaseView.prototype.doubleClickTest = function ()
{
    this.restartFlag = true;
    scheduleTask (doObject (this, function ()
    {
        this.restartFlag = false;
    }), null, 250);
};
