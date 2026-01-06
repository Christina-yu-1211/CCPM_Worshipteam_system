
import { Signup, ShuttleGroup, User, MinistryEvent, AdminTask, EmailLog } from './types';

// --- TIME UTILS ---
export const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes: number): string => {
  // Handle potentially negative minutes for early morning calculations (wrap around 24h if needed, though simple clamp is usually enough for this context)
  // Simple handling for now:
  let m = minutes;
  if (m < 0) m += 24 * 60; 
  
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
};

export const getDatesInRange = (startDateStr: string, endDateStr: string): string[] => {
    const dates = [];
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    
    // Safety check
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
        return [];
    }

    const current = new Date(start);
    while (current <= end) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        current.setDate(current.getDate() + 1);
    }
    return dates;
};

export const formatDateShort = (dateStr: string): string => {
    // Input YYYY-MM-DD, Output MM-DD
    if (!dateStr) return '';
    return dateStr.substring(5);
};

export const isEventPast = (endDateStr: string): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    // If end date is strictly before today (yesterday was the last day)
    return end < today;
};

// --- LOGIC UTILS ---

export const isLunchLocked = (eventStartDateStr: string): boolean => {
  const eventDate = new Date(eventStartDateStr);
  const now = new Date();
  const deadline = new Date(eventDate);
  deadline.setDate(eventDate.getDate() - 3);
  deadline.setHours(12, 0, 0, 0);
  return now > deadline;
};

// Get Start and End date of current season (Q1, Q2, Q3, Q4)
export const getCurrentSeasonRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  
  const startMonth = Math.floor(month / 3) * 3;
  const endMonth = startMonth + 3;
  
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth, 0); // Last day of previous month (effectively last day of quarter)
  
  // Format YYYY-MM-DD using local time hack
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { start: fmt(startDate), end: fmt(endDate) };
};

export const isDateInRange = (dateStr: string, startStr: string, endStr: string) => {
  return dateStr >= startStr && dateStr <= endStr;
};

// Generate Shuttle Groups for display
export const calculateShuttleGroups = (signups: Signup[], volunteerMap: Record<string, User>): ShuttleGroup[] => {
  const groups: ShuttleGroup[] = [];
  const locations = ['Zaoqiao', 'Zhunan', 'HSR_Miaoli'];

  // 1. ARRIVAL LOGIC
  const arrivalUsers = signups
    .filter(s => s.transportMode === 'shuttle' && s.arrivalTime && s.arrivalLocation)
    .sort((a, b) => timeToMinutes(a.arrivalTime!) - timeToMinutes(b.arrivalTime!));

  locations.forEach(loc => {
    const locUsers = arrivalUsers.filter(s => s.arrivalLocation === loc);
    let currentGroup: Signup[] = [];

    locUsers.forEach((user) => {
      if (currentGroup.length === 0) {
        currentGroup.push(user);
      } else {
        const firstInGroupTime = timeToMinutes(currentGroup[0].arrivalTime!);
        const userTime = timeToMinutes(user.arrivalTime!);
        if (userTime - firstInGroupTime <= 30) {
          currentGroup.push(user);
        } else {
          pushGroup(groups, currentGroup, volunteerMap, loc, 'arrival');
          currentGroup = [user];
        }
      }
    });
    if (currentGroup.length > 0) {
      pushGroup(groups, currentGroup, volunteerMap, loc, 'arrival');
    }
  });

  // 2. DEPARTURE LOGIC
  const departureUsers = signups
    .filter(s => s.departureMode === 'shuttle' && s.departureTime && s.departureLocation)
    .sort((a, b) => timeToMinutes(a.departureTime!) - timeToMinutes(b.departureTime!));

  locations.forEach(loc => {
    const locUsers = departureUsers.filter(s => s.departureLocation === loc);
    let currentGroup: Signup[] = [];

    locUsers.forEach((user) => {
      if (currentGroup.length === 0) {
        currentGroup.push(user);
      } else {
        const firstInGroupTime = timeToMinutes(currentGroup[0].departureTime!);
        const userTime = timeToMinutes(user.departureTime!);
        // Group departures: if within 30 mins
        if (userTime - firstInGroupTime <= 30) {
          currentGroup.push(user);
        } else {
          pushGroup(groups, currentGroup, volunteerMap, loc, 'departure');
          currentGroup = [user];
        }
      }
    });
    if (currentGroup.length > 0) {
      pushGroup(groups, currentGroup, volunteerMap, loc, 'departure');
    }
  });

  return groups;
};

const pushGroup = (groups: ShuttleGroup[], users: Signup[], map: Record<string, User>, loc: string, type: 'arrival' | 'departure') => {
  const isArrival = type === 'arrival';
  const getTime = (u: Signup) => isArrival ? u.arrivalTime! : u.departureTime!;
  
  const startTime = getTime(users[0]);
  const endTime = getTime(users[users.length - 1]);
  
  let departureMins;
  if (isArrival) {
     // Arrival: Departure from station = Last person time + 10 mins buffer
     departureMins = timeToMinutes(endTime) + 10;
  } else {
     // Departure: Departure from Mountain = Earliest Train Time - (Travel + Buffer)
     
     // 1. Define Travel Time based on location
     let travelTime = 20; // Default (Zhunan/HSR)
     if (loc === 'Zaoqiao') {
         travelTime = 10;
     } else if (loc === 'Zhunan') {
         travelTime = 20;
     } else if (loc === 'HSR_Miaoli') {
         travelTime = 20;
     }

     // 2. Define Buffer Time
     const bufferTime = 10;

     // 3. Calculate
     departureMins = timeToMinutes(startTime) - (travelTime + bufferTime); 
  }

  const locName = loc === 'Zaoqiao' ? '造橋車站' : loc === 'Zhunan' ? '竹南車站' : '苗栗高鐵';
  
  // Generate a consistent-ish ID for keying
  const groupId = `${type}_${loc}_${startTime}_${users.length}`;

  groups.push({
    id: groupId,
    type,
    location: locName,
    windowStart: startTime,
    windowEnd: endTime,
    suggestedDeparture: minutesToTime(departureMins),
    passengers: users.map(u => ({
      name: map[u.volunteerId]?.name || 'Unknown',
      phone: map[u.volunteerId]?.phone || '', // Keep prop for compat but empty
      time: getTime(u)
    }))
  });
};

export const generateDriverListText = (signups: Signup[], users: Record<string, User>, driverAssignments: Record<string, string>): string => {
  const groups = calculateShuttleGroups(signups, users);
  let text = "🚐 **禱告山接駁派車單** 🚐\n\n";
  
  if (groups.length === 0) return text + "目前無接駁需求";

  let arrivalCount = 0;
  let departureCount = 0;

  groups.forEach((g) => {
    const assignedDriverName = driverAssignments[g.id] 
      ? users[driverAssignments[g.id]]?.name 
      : '(未指派)';
    
    let carNumber = 0;
    if (g.type === 'arrival') {
        arrivalCount++;
        carNumber = arrivalCount;
    } else {
        departureCount++;
        carNumber = departureCount;
    }

    text += `【${g.type === 'arrival' ? '去程' : '回程'} - 第 ${carNumber} 車】\n`;
    text += `司機：${assignedDriverName}\n`;
    text += `地點：${g.location}\n`;
    text += `建議發車：${g.suggestedDeparture}\n`;
    text += `乘客名單：\n`;
    g.passengers.forEach(p => {
      text += `- ${p.time} ${p.name}\n`;
    });
    text += `------------------\n`;
  });

  return text;
};

// Generate CSV Data URI
export const generateCSV = (data: any[]): string => {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(','));
  const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
  return encodeURI(csvContent);
};

// Smart Shuttle Alert Logic
export const getSmartShuttleAlert = (userTime: string, otherSignups: Signup[], isDeparture: boolean = false): number => {
  if (!userTime || otherSignups.length === 0) return 0;
  const userMinutes = timeToMinutes(userTime);
  let count = 0;
  
  otherSignups.forEach(s => {
    const time = isDeparture ? s.departureTime : s.arrivalTime;
    if (time) {
      const otherMinutes = timeToMinutes(time);
      if (Math.abs(userMinutes - otherMinutes) <= 30) {
        count++;
      }
    }
  });
  
  return count;
};

export const checkEmailTriggers = (
  events: MinistryEvent[], 
  signups: Signup[], 
  users: User[], 
  tasks: AdminTask[]
): EmailLog[] => {
  // Mock implementation for email system
  return [];
};

export const FUNNY_QUOTES = [
  "不管你是在造橋還是竹南，上帝都會為你『造橋』鋪路！",
  "接駁車座位有限，但恩典無限！",
  "雖然你不是為了便當而來，但上帝會讓你的靈魂『飽』受恩典！",
  "人活著不單靠食物，但服事確實需要熱量！",
  "你的出席率比高鐵還準時，你的熱情比區間車還溫馨。",
  "服事不累，因為有主陪你『喬』時間。",
];

export const getRandomQuote = () => FUNNY_QUOTES[Math.floor(Math.random() * FUNNY_QUOTES.length)];

export const getBadgeDetails = (count: number, streak: number) => {
  if (streak === 2) return { title: "連續2個月", quote: "你的穩定度，連聖靈都感動！", icon: "🔥" };
  if (streak >= 3) return { title: "穩定長青", quote: "你是造橋車站最熟悉的風景。", icon: "🏔️" };
  if (count === 3) return { title: "新手上路", quote: "事不過三，服事要『三』！", icon: "🥉" };
  if (count === 5) return { title: "擊掌慶祝", quote: "『五』告厲害！神看你的服事為美！", icon: "🖐️" };
  if (count >= 10) return { title: "十全十美", quote: "你是上帝派來造橋的超級英雄！", icon: "🦸" };
  return null;
};
