import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UserPlus, CheckCircle2, AlertCircle, Sparkles, HelpCircle } from 'lucide-react';

interface PlayerRegistrationViewProps {
  onSuccess: () => void;
}

const BASE_PRICE_LADDER = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 230, 250];

export const PlayerRegistrationView: React.FC<PlayerRegistrationViewProps> = ({ onSuccess }) => {
  const [rollNumber, setRollNumber] = useState('');
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [cricheroesUrl, setCricheroesUrl] = useState('');
  const [cricheroesMobile, setCricheroesMobile] = useState('');
  const [basePrice, setBasePrice] = useState<number>(20);

  // Parsed Roll Number Info
  const [parsedInfo, setParsedInfo] = useState<any>(null);

  // Branching Skill Questionnaire
  const [isSkilledBatter, setIsSkilledBatter] = useState<boolean>(false);
  const [battingStyle, setBattingStyle] = useState<string>('Aggressive batter');
  const [preferredBattingPos, setPreferredBattingPos] = useState<string>('Middle order');
  const [battingArm, setBattingArm] = useState<string>('Right');

  const [isSkilledBowler, setIsSkilledBowler] = useState<boolean>(false);
  const [bowlingArm, setBowlingArm] = useState<string>('Right');
  const [bowlingType, setBowlingType] = useState<string>('Fast');
  const [paceVariety, setPaceVariety] = useState<string>('Express pace');
  const [spinVariety, setSpinVariety] = useState<string>('Off-spin');
  const [bowlingRoles, setBowlingRoles] = useState<string>('Powerplay specialist');

  const [isWicketKeeper, setIsWicketKeeper] = useState<boolean>(false);
  const [fieldingZone, setFieldingZone] = useState<string>('Infield');
  const [preferredFieldingPos, setPreferredFieldingPos] = useState<string>('Cover');

  const [confirmFielderOnly, setConfirmFielderOnly] = useState<boolean>(false);

  // Experience & Stats
  const [highestLevelPlayed, setHighestLevelPlayed] = useState<string>('Recreational only');
  const [playedAccBefore, setPlayedAccBefore] = useState<boolean>(false);
  const [previousAccTeam, setPreviousAccTeam] = useState<string>('');
  const [referringTeamName, setReferringTeamName] = useState<string>('');

  const [matches, setMatches] = useState<number>(10);
  const [runs, setRuns] = useState<number>(150);
  const [battingAvg, setBattingAvg] = useState<number>(25.0);
  const [strikeRate, setStrikeRate] = useState<number>(130.0);
  const [wickets, setWickets] = useState<number>(0);
  const [economy, setEconomy] = useState<number>(0.0);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Auto-parse roll number as user types
  useEffect(() => {
    if (rollNumber.trim().length >= 8) {
      api.parseRollNumber(rollNumber).then((data) => setParsedInfo(data)).catch(() => setParsedInfo(null));
    } else {
      setParsedInfo(null);
    }
  }, [rollNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    // Validation rule §5.1
    if (!isSkilledBatter && !isSkilledBowler && !isWicketKeeper && !confirmFielderOnly) {
      setStatusMsg({
        type: 'error',
        text: 'Validation Error: You have not selected any cricketing skill (Batter, Bowler, or Wicket-keeper). Please select at least one skill or explicitly check the Fielder Only confirmation box.',
      });
      return;
    }

    try {
      await api.registerPlayer({
        roll_number: rollNumber,
        name,
        mobile_number: mobileNumber,
        photo_url: photoUrl,
        cricheroes_url: cricheroesUrl,
        cricheroes_mobile: cricheroesMobile,
        base_price: basePrice,
        is_skilled_batter: isSkilledBatter,
        batting_style: isSkilledBatter ? battingStyle : undefined,
        preferred_batting_pos: isSkilledBatter ? preferredBattingPos : undefined,
        batting_arm: battingArm,
        is_skilled_bowler: isSkilledBowler,
        bowling_arm: isSkilledBowler ? bowlingArm : undefined,
        bowling_type: isSkilledBowler ? bowlingType : undefined,
        pace_variety: isSkilledBowler && bowlingType === 'Fast' ? paceVariety : undefined,
        spin_variety: isSkilledBowler && bowlingType === 'Spin' ? spinVariety : undefined,
        bowling_roles: isSkilledBowler ? bowlingRoles : undefined,
        is_wicket_keeper: isWicketKeeper,
        fielding_zone: !isWicketKeeper ? fieldingZone : undefined,
        preferred_fielding_pos: !isWicketKeeper ? preferredFieldingPos : undefined,
        highest_level_played: highestLevelPlayed,
        played_acc_before: playedAccBefore,
        previous_acc_team: playedAccBefore ? previousAccTeam : undefined,
        referring_team_name: parsedInfo?.show_acc_reference ? referringTeamName : undefined,
        matches,
        runs,
        batting_avg: battingAvg,
        strike_rate: strikeRate,
        wickets,
        economy,
      });

      setStatusMsg({ type: 'success', text: 'Registration submitted successfully! Registered under status Completed/Pending profile.' });
      onSuccess();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Registration failed' });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 text-center space-y-2 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/40">
          <UserPlus className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black text-white">Player Registration Form</h1>
        <p className="text-xs text-indigo-300">Avanthi Cricket Carnival 2026–27 &bull; Student Entry Portal</p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border flex items-center space-x-3 text-xs font-bold shadow-lg ${statusMsg.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500' : 'bg-red-950/90 text-red-300 border-red-500'
            }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information & Live Roll Number Parser */}
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>1. Basic Student Info &amp; Roll Number Parsing</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Roll Number *</label>
              <input
                type="text"
                placeholder="e.g. 25811A0403 or 24597-CM-015"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value.toUpperCase())}
                className="w-full glass-input rounded-xl p-3 text-xs uppercase font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Full Name *</label>
              <input
                type="text"
                placeholder="Full Student Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full glass-input rounded-xl p-3 text-xs"
                required
              />
            </div>
          </div>

          {/* Parsed Info Box (§4.1) */}
          {parsedInfo && (
            <div className="bg-indigo-950/60 border border-indigo-500/40 p-4 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-indigo-300">Authoritative Academic Parser Result:</p>
              <p className="text-white font-medium">{parsedInfo.formatted_summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Mobile Number (Private) *</label>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full glass-input rounded-xl p-3 text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">Photograph URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                className="w-full glass-input rounded-xl p-3 text-xs"
              />
            </div>
          </div>

          {/* CricHeroes Profile Section (§5.2) */}
          <div className="pt-2 space-y-3 border-t border-gray-800">
            <h4 className="text-xs font-bold text-gray-300">CricHeroes Profile Details (§5.2)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">CricHeroes Profile URL</label>
                <input
                  type="url"
                  placeholder="https://cricheroes.in/..."
                  value={cricheroesUrl}
                  onChange={(e) => setCricheroesUrl(e.target.value)}
                  className="w-full glass-input rounded-xl p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1">CricHeroes Registered Phone</label>
                <input
                  type="tel"
                  placeholder="Registered phone on CricHeroes"
                  value={cricheroesMobile}
                  onChange={(e) => setCricheroesMobile(e.target.value)}
                  className="w-full glass-input rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            {(!cricheroesUrl || !cricheroesMobile) && (
              <p className="text-[11px] text-amber-400 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/50">
                Notice: If you don't have a CricHeroes profile yet, you can still submit! Your profile status will be set to "profile creation pending" for Super Admin resolution.
              </p>
            )}
          </div>

          {/* Base Price Ladder (§5) */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-gray-300 block mb-2">Base Price (Choose from fixed ladder) *</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {BASE_PRICE_LADDER.map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setBasePrice(val)}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${basePrice === val
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black border-amber-400 shadow-md font-extrabold'
                    : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'
                    }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Branching Skill Questionnaire (§5.1) */}
        <div className="glass-panel rounded-3xl p-6 border border-gray-800 space-y-6">
          <h3 className="text-base font-bold text-white">2. Skill Profile (Branching Questionnaire)</h3>

          {/* Section A - Batting */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Do you consider yourself a skilled batter?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSkilledBatter(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isSkilledBatter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsSkilledBatter(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isSkilledBatter ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>

            {isSkilledBatter && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Batting Style</label>
                  <select
                    value={battingStyle}
                    onChange={(e) => setBattingStyle(e.target.value)}
                    className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                  >
                    <option value="Aggressive batter">Aggressive batter</option>
                    <option value="Strike rotator">Strike rotator</option>
                    <option value="Big hitter">Big hitter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Preferred Position</label>
                  <select
                    value={preferredBattingPos}
                    onChange={(e) => setPreferredBattingPos(e.target.value)}
                    className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                  >
                    <option value="Opener">Opener</option>
                    <option value="Top order">Top order</option>
                    <option value="Middle order">Middle order</option>
                    <option value="Finisher">Finisher</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section B - Bowling */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Do you consider yourself a skilled bowler?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSkilledBowler(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isSkilledBowler ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsSkilledBowler(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isSkilledBowler ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>

            {isSkilledBowler && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Bowling Arm &amp; Type</label>
                  <div className="flex gap-2">
                    <select
                      value={bowlingArm}
                      onChange={(e) => setBowlingArm(e.target.value)}
                      className="w-1/2 glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Right">Right Arm</option>
                      <option value="Left">Left Arm</option>
                    </select>

                    <select
                      value={bowlingType}
                      onChange={(e) => setBowlingType(e.target.value)}
                      className="w-1/2 glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Fast">Fast</option>
                      <option value="Spin">Spin</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Variety</label>
                  {bowlingType === 'Fast' ? (
                    <select
                      value={paceVariety}
                      onChange={(e) => setPaceVariety(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Express pace">Express pace</option>
                      <option value="Swing">Swing</option>
                      <option value="Seam">Seam</option>
                    </select>
                  ) : (
                    <select
                      value={spinVariety}
                      onChange={(e) => setSpinVariety(e.target.value)}
                      className="w-full glass-input rounded-xl p-2 text-xs bg-gray-900 text-white"
                    >
                      <option value="Off-spin">Off-spin</option>
                      <option value="Leg-spin">Leg-spin</option>
                      <option value="Left-arm orthodox">Left-arm orthodox</option>
                      <option value="Left-arm wrist spin">Left-arm wrist spin</option>
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section C - Wicket-keeping */}
          <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">Are you a wicket-keeper?</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWicketKeeper(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${isWicketKeeper ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsWicketKeeper(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold ${!isWicketKeeper ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          {/* Fielder Only Confirmation Rule */}
          {!isSkilledBatter && !isSkilledBowler && !isWicketKeeper && (
            <div className="bg-amber-950/60 border border-amber-500/50 p-4 rounded-2xl space-y-2">
              <p className="text-xs text-amber-300 font-bold">No cricketing skill claimed yet.</p>
              <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmFielderOnly}
                  onChange={(e) => setConfirmFielderOnly(e.target.checked)}
                  className="rounded bg-gray-900 border-gray-700"
                />
                <span>I explicitly confirm that I am registering as a Fielder only.</span>
              </label>
            </div>
          )}
        </div>

        {/* ACC Reference Declaration (§5) */}
        {parsedInfo?.show_acc_reference && (
          <div className="glass-panel rounded-3xl p-6 border border-indigo-500/40 space-y-3">
            <h3 className="text-sm font-bold text-indigo-300">ACC Reference Program Declaration (§5)</h3>
            <p className="text-xs text-gray-400">Did you join Avanthi through the ACC reference program, and if so, which team referred you?</p>
            <input
              type="text"
              placeholder="Referring team name (or leave empty if none)"
              value={referringTeamName}
              onChange={(e) => setReferringTeamName(e.target.value)}
              className="w-full glass-input rounded-xl p-3 text-xs"
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-base rounded-2xl shadow-xl shadow-blue-500/25"
        >
          SUBMIT PLAYER REGISTRATION
        </button>
      </form>
    </div>
  );
};