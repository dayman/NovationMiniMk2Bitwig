// Written by Andrey Antonov
// (c) 2016
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

loadAPI(1);

host.defineController("Novation", "Launchkey Mini mk2", "1.0", "D33B6F4A-8AA7-4609-B72C-C8139127CF2B", "Andrey Antonov");
host.defineMidiPorts(2, 2);
// TODO for autodiscovery add
host.addDeviceNameBasedDiscoveryPair(["Launchkey Mini mk2", "MIDIIN2 (Launchkey Mini mk2)"], ["Launchkey Mini mk2", "Launchkey Mini mk2"]);
host.addDeviceNameBasedDiscoveryPair(["Launchkey Mini mk2 MIDI", "MIDIIN2 (Launchkey Mini mk2)"], ["Launchkey Mini mk2", "Launchkey Mini mk2"]);

var ledstate = initArray(-1, 18);
var pendingLedstate = initArray(0, 18);

var selectedPage = 0;
var numParameterPages = 0;

function mixColour(red, green, blink)
{
   return (blink ? 8 : 12) | red | (green * 16);
}

function updateOutputState()
{
   for(var i=0; i<8; i++)
   {
      pendingLedstate[i] = (selectedPage == i)
         ? mixColour(3, 3, false)
         : (i < numParameterPages) ? mixColour(1, 1, false) : 0;

      var j = i + 9;

      pendingLedstate[j] = (modSourceStates.values[i])
         ? (blink ? mixColour(1, 3, false) : mixColour(0, 1, false))
         : 0;
   }
}

function flushOutputState()
{
   for(var i=0; i<9; i++)
   {
      if (pendingLedstate[i] != ledstate[i])
      {
         ledstate[i] = pendingLedstate[i];
         host.getMidiOutPort(1).sendMidi(0x90, 96 + i, ledstate[i]);
      }

      var j = i + 9;
      if (pendingLedstate[j] != ledstate[j])
      {
         ledstate[j] = pendingLedstate[j];
         host.getMidiOutPort(1).sendMidi(0x90, 112 + i, ledstate[j]);
      }
   }
}

/* Simple buffer array with setter. */

function BufferedElementArray(initialVal, count)
{
   this.values = initArray(initialVal, count);
}

/* Return a setter function for the specific index. */
BufferedElementArray.prototype.setter = function(index)
{
   var obj = this;

   return function(data)
   {
      obj.set(index, data);
   }
};

BufferedElementArray.prototype.set = function(index, data)
{
   this.values[index] = data;
};

var modSourceStates = new BufferedElementArray(false, 8);

function init()
{
   host.getMidiInPort(0).createNoteInput("Launchkey Mini mk2", "80????", "90????", "B001??", "D0????", "E0????");
   host.getMidiInPort(0).createNoteInput("Launchkey Mini mk2 Pads", "89????", "99????");

   host.getMidiInPort(0).setMidiCallback(onMidi0);
   host.getMidiInPort(1).setMidiCallback(onMidi1);

	 transport = host.createTransport();

   cursorTrack = host.createCursorTrack(2, 2);
   masterTrack = host.createMasterTrack(0);

   primaryDevice = cursorTrack.getPrimaryDevice();

   primaryDevice.addSelectedPageObserver(-1, function(value)
   {
      selectedPage = value;
   });

   primaryDevice.addPageNamesObserver(function()
   {
      numParameterPages = arguments.length;
   });

   //trackBank = host.createTrackBank(8, 0, 0);

   for(var p=0; p<8; p++)
   {
      var modSource = primaryDevice.getModulationSource(p);
      modSource.addIsMappingObserver(modSourceStates.setter(p));
   }

   userControls = host.createUserControls(8);

   for(var p=0; p<8; p++)
   {
      userControls.getControl(p).setLabel("User " + (p + 1));
   }

   sendMidi(0x90, 0x0C, 0x7F);
   host.getMidiOutPort(1).sendMidi(0x90, 0x0C, 0x7F);

   //updateIndications();

   host.scheduleTask(blinkTimer, null, 100);

   //for(var t=0; t<8; t++) {
       // This looks like it would make sense, but it doesn't work
  //     trackBank.getTrack(t).addNameObserver(8, "", function(name) {
         //println("Track " + t + " name: " + name);
    //   });
    //}

    clipGrid = host.createTrackBank(8, 0, 1);

    //host.createTrackBank(1, 0, 1).getTrack(0).getClipLauncherSlots().setIndication(true);
    //println(trackBank.getTrack(0).getClipLauncher());
    //clipCursor = host.createCursorClip(8, 1);
    //clipCursor.setStepLength(2);
    //clipCursor.getAccent().setRaw(10);
    //println(trackBank.getTrack(0).getClipLauncherSlots());
}

var fastblink = false;
var blink = false;

function blinkTimer()
{
   fastblink = !fastblink;

   if (fastblink)
   {
      blink = !blink;
   }

   host.getMidiOutPort(1).sendMidi(144, 120, 10);
   //host.scheduleTask(blinkTimer, null, 100);
}

/*function updateIndications()
{
   for(var i=0; i<8; i++)
   {
      primaryDevice.getParameter(i).setIndication(true);
      userControls.getControl(i).setIndication(true);
      primaryDevice.getMacro(i).getAmount().setIndication(true);
      //trackBank.getTrack(i).getVolume().setIndication(true);

   }
}*/

function exit()
{
   sendMidi(0x90, 0x0C, 0x00);
}

function flush()
{
   updateOutputState();
   flushOutputState();
}

function onMidi0(status, data1, data2)
{
	//printMidi(status, data1, data2);

   if (isChannelController(status))
   {
      if (data1 >= 21 && data1 <= 28)
      {
         var knobIndex = data1 - 21;

         userControls.getControl(knobIndex).set(data2, 128);
      }
      else if (data1 >= 51 && data1 <= 58)
      {
         var buttonIndex = data1 - 51;

         if (data2 == 127)
         {
            trackBank.getTrack(buttonIndex).select();
         }
      }
   }
}

var incontrol_mix = true;

function onMidi1(status, data1, data2)
{
   //printMidi(status, data1, data2);
   println("---")
   println("status=" + status)
   println("button=" + data1)
   println("value=" + data2)
   if (isChannelController(status))
   {
      if (data1 >= 21 && data1 <= 28)
      {
         var knobIndex = data1 - 21;

         primaryDevice.getParameter(knobIndex).set(data2, 128);
      }
      else if (data1 >= 51 && data1 <= 58)
      {
         var buttonIndex = data1 - 51;

         if (data2 == 127)
         {
            primaryDevice.getMacro(buttonIndex).getModulationSource().toggleIsMapping();
         }
      }
   }

   if(data1 == 106 && data2 == 127 && status == 176) {
     println("Button left")
     //trackBank.scrollTracksPageUp();
     clipGrid.scrollTracksPageUp();
     //clipGrid.scrollScenesPageUp();
     for(var i=0; i<8; i++){
        clipGrid.getTrack(i).getClipLauncherSlots().setIndication(true);
     }
     //clipCursor.scrollStepsPageForward();
   } else if (data1 == 107 && data2 == 127 && status == 176) {
     println("Button right")
     //trackBank.scrollTracksPageDown();
     clipGrid.scrollTracksPageDown();
     //clipGrid.scrollScenesPageDown();
     for(var i=0; i<8; i++){
        clipGrid.getTrack(i).getClipLauncherSlots().setIndication(true);
     }
     //clipCursor.scrollStepsPageBackwards();
   }

   if(data1 == 104 && data2 == 127 && status == 176) {
     println("Button up")
     clipGrid.scrollScenesPageUp();
     for(var i=0; i<8; i++){
        clipGrid.getTrack(i).getClipLauncherSlots().setIndication(true);
     }
   } else if (data1 == 105 && data2 == 127 && status == 176) {
     println("Button down")
     clipGrid.scrollScenesPageDown();
     for(var i=0; i<8; i++){
        clipGrid.getTrack(i).getClipLauncherSlots().setIndication(true);
     }
   }

    // button presses

    if (data1 == 102)
    {
       //if (incontrol_mix)
       //{
          cursorTrack.selectPrevious();
       //}
       //else
       //{
        //  trackBank.scrollTracksPageUp();
    //   }
    }
    else if (data1 == 103)
    {
      // if (incontrol_mix)
      // {
          cursorTrack.selectNext();
       //}
       //else
       //{
      //    trackBank.scrollTracksPageDown();
       //}
    }
    else if (data1 == 112)
    {
       transport.rewind();
    }
    else if (data1 == 113)
    {
       transport.fastForward();
    }
    else if (data1 == 114)
    {
       transport.stop();
    }
    else if (data1 == 115)
    {
       transport.play();
    }
    else if (data1 == 116)
    {
       transport.toggleLoop();
    }
    else if (data1 == 117)
    {
       transport.record();
    }

   if (MIDIChannel(status) == 0 && isNoteOn(status))
   {
     println("second section")
      if (data1 >= 96 && data1 < 104)
      {
         var i = data1 - 96;
         primaryDevice.setParameterPage(i);
         // wtf?
      }
      else if (data1 >= 112 && data1 < 120)
      {
         var i = data1 - 112;
         primaryDevice.getModulationSource(i).toggleIsMapping();
         // toggle device section
      }
      else if (data1 == 104)
      {
         primaryDevice.switchToPreviousPreset();
         // select preset up
      }
      else if (data1 == 120)
      {
         primaryDevice.switchToNextPreset();
         // select preset down
      }

      if (data1 == 10)
      {
         incontrol_mix = data2 == 127;
         host.showPopupNotification(incontrol_mix ? "Sliders: Macros" : "Sliders: Mixer");
         updateIndications();
      }
   }
}
