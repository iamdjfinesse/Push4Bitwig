// Written by Jürgen Moßgraber - mossgrabers.de
//            Michael Schmalle - teotigraphix.com
// (c) 2014
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

function ParamPageMode (model, mode, name)
{
    BaseMode.call (this, model);
    this.id = mode;
    this.name = name;
    this.params = [ { index: 0, name: '' }, { index: 1, name: '' }, { index: 2, name: '' }, { index: 3, name: '' }, { index: 4, name: '' }, { index: 5, name: '' }, { index: 6, name: '' }, { index: 7, name: '' } ];
}
ParamPageMode.prototype = new BaseMode ();

ParamPageMode.prototype.attachTo = function (surface)
{
    BaseMode.prototype.attachTo.call (this, surface);
    
    for (var i = 0; i < 8; i++)
    {
        var p = this.getParameter (i);
        var n = this.getNameParameter (i);

        // Parameter name [Dumb hack for inconsistent API naming]
        if (this.id == MODE_BANK_MACRO)
        {
            n.addLabelObserver (8, '', doObjectIndex (this, i, function (index, name)
            {
                this.params[index].name = name;
            }));
        }
        else
        {
            n.addNameObserver (8, '', doObjectIndex (this, i, function (index, name)
            {
                this.params[index].name = name;
            }));
        }

        if (this.id == MODE_BANK_MODULATE)
        {
            p.addIsMappingObserver (doObjectIndex (this, i, function (index, isMapping)
            {
                this.params[index].value = isMapping;
                this.params[index].valueStr = isMapping ? 'On' : 'Off';
            }));
        }
        else
        {
            p.addValueObserver (Config.maxParameterValue, doObjectIndex (this, i, function (index, value)
            {
                this.params[index].value = value;
            }));
            // Parameter value text
            p.addValueDisplayObserver (8, '',  doObjectIndex (this, i, function (index, value)
            {
                this.params[index].valueStr = value;
            }));
        }
    }
};

ParamPageMode.prototype.getParameter = function (index)
{
    switch (this.id)
    {
        case MODE_BANK_COMMON:
            return this.model.getCursorDevice ().getCommonParameter (index);
        case MODE_BANK_ENVELOPE:
            return this.model.getCursorDevice ().getEnvelopeParameter (index);
        case MODE_BANK_USER:
            return this.model.getUserControlBank ().getControl (index);
        case MODE_BANK_MACRO:
            return this.model.getCursorDevice ().getMacro (index).getAmount ();
        case MODE_BANK_MODULATE:
            return this.model.getCursorDevice ().getModulationSource (index);
    }
};

ParamPageMode.prototype.getNameParameter = function (index)
{
    switch (this.id)
    {
        case MODE_BANK_COMMON:
            return this.model.getCursorDevice ().getCommonParameter (index);
        case MODE_BANK_ENVELOPE:
            return this.model.getCursorDevice ().getEnvelopeParameter (index);
        case MODE_BANK_USER:
            return this.model.getUserControlBank ().getControl (index);
        case MODE_BANK_MACRO:
            return this.model.getCursorDevice ().getMacro (index);
        case MODE_BANK_MODULATE:
            return this.model.getCursorDevice ().getModulationSource (index);
    }
};

ParamPageMode.prototype.onValueKnob = function (index, value)
{
    if (this.id == MODE_BANK_MODULATE)
    {
        if ((value <= 61 && !this.params[index].value) ||
            (value > 61 && this.params[index].value))
            this.getParameter (index).toggleIsMapping ();
        return;
    }
    this.params[index].value = this.surface.changeValue (value, this.params[index].value);
    this.getParameter (index).set (this.params[index].value, Config.maxParameterValue);
};

ParamPageMode.prototype.onFirstRow = function (index) {};

ParamPageMode.prototype.onSecondRow = function (index) {};

ParamPageMode.prototype.updateDisplay = function ()
{
    var d = this.surface.getDisplay ();
    if (this.hasParams ())
    {
        for (var i = 0; i < 8; i++)
        {
            if (this.params[i].name.length == 0)
                d.clearCell (0, i).clearCell (1, i).clearCell (2, i);
            else
            {
                d.setCell (0, i, this.params[i].name, Display.FORMAT_RAW)
                 .setCell (1, i, this.params[i].valueStr, Display.FORMAT_RAW)
                 .setCell (2, i, this.params[i].value, Display.FORMAT_VALUE);
            }
        }
        if (this.id == MODE_BANK_MODULATE)
            d.clearRow (2);
    }
    else
    {
        d.clearRow (0).clearRow (1).clearRow (2)
         .setBlock (1, 1, d.padLeft ('No ' + this.name, 17, ' ')).setCell (1, 4, 'Assigned');
    }
    if (this.model.hasSelectedDevice ())
    {
        d.setCell (3, 0, 'Selected', Display.FORMAT_RAW).setCell (3, 1, 'Device: ', Display.FORMAT_RAW)
         .setBlock (3, 1, this.model.getSelectedDevice ().name)
         .setBlock (3, 2, this.name, Display.FORMAT_RAW)
         .clearBlock (3);
    }
    else
        d.clearRow (3);
    d.allDone ();
};

ParamPageMode.prototype.updateFirstRow = function ()
{
    for (var i = 0; i < 8; i++)
        this.surface.setButton (20 + i, PUSH_COLOR_BLACK);
};

ParamPageMode.prototype.updateSecondRow = function ()
{
    for (var i = 0; i < 8; i++)
        this.surface.setButton (102 + i, PUSH_COLOR2_BLACK);
};

ParamPageMode.prototype.hasParams = function ()
{
    for (var i = 0; i < 8; i++)
    {
        if (this.params[i].name.length != 0)
            return true;
    }
    return false;
};
