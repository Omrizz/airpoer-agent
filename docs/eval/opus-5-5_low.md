# Evaluation run

Model: `claude-opus-5-5`, effort: `low`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.26.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1160, cache-read 6900 | **Est. cost:** $0.054  
**Grounding:** 35/36 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate, with a score of 72.2 and a national rank of 11.** Portland, Maine (PWM, 65.1) comes next. Bangor (BGR) and Burlington (BTV) both score 63.2 and are effectively tied for third. Bradley (BDL, 58.2) is a step behind. Providence (PVD), Tweed New Haven (HVN) and Manchester (MHT) are weaker.
> 
> **Why each airport ranks where it does**
> - **BOS:** It has the biggest potential: 20.9M passengers in the last 12 months, and the FAA forecasts 5.6M more enplanements by 2035 (93rd percentile nationally). The ground is congested, with a P90 taxi-out of 35.0 min (93rd percentile). Planes are full, with a load factor of 81.3%. The weak point is that passengers fell 2.3% year on year.
> - **PWM:** Demand pressure is high. The peak-month load factor is 88.9% (93rd percentile) and the 12-month load factor is 81.7%. It's a much smaller airport, at 1.3M passengers.
> - **BGR:** Growth is the main driver. Passengers rose 17.5% year on year (99th percentile), and taxi-out time is high (31.0 min). But it's small, at 477k passengers, so the potential is limited.
> - **BTV:** It has the highest demand pressure in the region. Passengers grew 3.8 points faster than seats (97th percentile), and the P90 taxi-out is 36.4 min. Passengers fell 1.8% year on year, though.
> - **BDL:** Planes are full (81.4% load factor), but the growth outlook is weak. Passengers fell 4.3% and the FAA forecasts only 1.5% a year over 10 years.
> 
> **Assumptions and limits**
> - **Weights:** I used the default weights: demand pressure 30%, congestion 25%, growth 25%, size 20%. The top 5 keep their order when each weight is shifted by ±20%. The only change is that BGR and BTV swap places.
> - **Congestion data:** The congestion figures rest on a single month of on-time data, July 2025, which is a summer peak. They may overstate year-round congestion, which matters most for the seasonal Maine airports. Taxi-out times and delays are only proxies. They don't show whether the terminal, the runways or the airspace is the real bottleneck.
> - **HVN:** It has no on-time data, so its score was re-weighted without congestion and is low-confidence.
> - **Period:** Traffic data covers August 2025 to July 2026 [T-100]. Forecasts come from the FAA Terminal Area Forecast, 2025 edition.
> - **Coverage:** Only airports with at least 300k departing passengers a year were scored. Fifteen New England airports fell below that line and were not scored, which is not the same as scoring low. They include Nantucket (ACK), Worcester (ORH), Martha's Vineyard (MVY) and Portsmouth (PSM).
> - **What this is:** This is a demand screen, not an investment recommendation. It doesn't model construction cost, returns or existing terminal capacity.
> 
> As a next step, I can compare BOS against the next tier, or look at demand gaps at PWM or BTV.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 996, cache-read 9317 | **Est. cost:** $0.027  
**Grounding:** 37/42 figures traced to tool output; untraced: 1.9, 5.5, 0.3, 7.8

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> **Portland edges out Bangor by 1.9 points (65.1 vs 63.2, derived), because its stronger demand pressure and larger size outweigh Bangor's much stronger growth.** The gap is small, but the two airports keep their order when the weights shift by ±20%: PWM stays 2nd and BGR ranges between 3rd and 4th.
> 
> **Where the points come from** (weighted points, PWM vs BGR; differences derived)
> | Component (weight) | PWM | BGR | Net to PWM |
> |---|---|---|---|
> | Demand pressure (30%) | 24.0 | 20.1 | +3.9 |
> | Size of prize (20%) | 9.4 | 3.9 | +5.5 |
> | Congestion (25%) | 19.5 | 19.2 | +0.3 |
> | Growth (25%) | 12.2 | 20.0 | −7.8 |
> 
> - **Demand pressure:** Portland's planes are fuller. Its 12-month load factor is 81.7% against Bangor's 79.7%, and its peak-month load factor is 88.9% against 87.2% [T-100].
> - **Size:** Portland handled 1.3M passengers against Bangor's 477k. The FAA forecasts 278k more enplanements at Portland and 103k at Bangor [FAA TAF].
> - **Congestion:** This is close to a wash. Bangor has the longer taxi-out (31.0 vs 27.0 min) and a higher share of delays caused by the air-traffic system. Portland has more departures delayed 15+ minutes (28.7% vs 25.0%).
> - **Growth:** This is Bangor's big advantage. Its passengers grew 17.5% year on year (99th percentile), against 0.7% at Portland. It's not quite enough to close the gap on demand and size.
> 
> **Assumptions and limits**
> - **Weights:** The order depends on the default weights. More weight on growth would favour Bangor, and more weight on size would favour Portland. The ±20% test didn't flip them, but a bigger shift could. At 1.9 points apart, treat them as close.
> - **Bangor's growth:** That 17.5% jump is a single year of data. The FAA's 10-year forecast for Bangor is a more modest 2.2% a year.
> - **Congestion data:** For both airports this rests on one month (July 2025). That's likely to overstate congestion at seasonal Maine airports.
> - **What this is:** This screens demand only. It doesn't assess either airport's current terminal capacity, its cost or its returns.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"demand_pressure":0.3,"congestion":0.1,"growth":0.45,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1247, cache-read 21904 | **Est. cost:** $0.065  
**Grounding:** 35/36 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Shifting weight from congestion to growth moves Bangor (BGR) up to 2nd, just behind Boston (BOS), and pushes Portland (PWM) down to 3rd.** BOS (65.6) and BGR (64.5) are now effectively tied: across the ±20% weight test, either could rank first. The bigger shift is lower down, where Tweed New Haven (HVN) moves ahead of Bradley (BDL).
> 
> **Weights I used:** growth 43%, demand pressure 29%, scale 19%, congestion 10%, down from 25/30/20/25. You didn't give exact figures, so this is my reading of "much more."
> 
> **What moved**
> | Rank | Default | Growth-heavy |
> |---|---|---|
> | 1 | BOS 72.2 | BOS 65.6 |
> | 2 | PWM 65.1 | BGR 64.5 (up from 3rd) |
> | 3 | BGR 63.2 | PWM 60.2 |
> | 4 | BTV 63.2 | BTV 56.0 |
> | 5 | BDL 58.2 | HVN 49.9 (up from 7th) |
> | 6 | PVD 52.1 | BDL 48.4 |
> 
> - **BGR rises** because it has the region's best growth score (80.1). That now earns it 34.3 points, against 20.0 before.
> - **BOS holds on** thanks to the FAA's forecast of 5.6M more enplanements, even though its passengers fell 2.3% last year.
> - **BDL drops** because its growth is the weakest in the group. Passengers fell 4.3% and the FAA forecasts only 1.5% a year.
> - **HVN moves up** because its passengers grew 3.6%. Its score is low-confidence, though, since it has no congestion data and was scored on the other components only. It could rank 5th or 6th.
> 
> **Assumptions and limits**
> - **Bangor rests on one year.** Its growth lead comes mainly from a single 17.5% jump in the last 12 months. Its 10-year FAA forecast (2.2% a year) is only middling. If that jump was a one-off, its higher rank won't last.
> - **Congestion matters less now.** Cutting its weight to 10% also reduces the effect of the one-month summer sample (July 2025), which was a known weakness.
> - **Growth isn't the same as a terminal shortage.** Fast growth shows demand is coming, not that the current terminal is too small.
> - **Same scope as before:** August 2025 to July 2026 traffic data, and the same 15 small airports not scored. This is a demand screen, with no cost or return modelling.
> 
> I can test a different weighting if you have one in mind, or run a demand-gap check on Bangor to see whether its growth is filling planes.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 1232, cache-read 11393 | **Est. cost:** $0.042  
**Grounding:** 33/36 figures traced to tool output; untraced: 10%, 90, 4.0%

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **LAX and John Wayne (SNA) have about the same congestion per flight. Neither is clearly worse.** SNA gets the higher congestion score (65.9 vs 56.0 out of 100), but the raw delay and taxi measures are close and split both ways. The real difference is size: LAX handles about 6.5 times as many passengers, so its total delay is much larger.
> 
> I took "LA" to mean LAX, the main Los Angeles airport. "LA" can also cover Burbank, Long Beach and Ontario, and it is also the code for Louisiana. "Santa Ana" is John Wayne Airport.
> 
> **Per-flight congestion (July 2025 on-time data):**
> 
> | Measure | LAX | SNA |
> |---|---|---|
> | Average taxi-out time | 17.5 min | 16.4 min |
> | Slowest 10% of taxi-outs (90th percentile) | 26 min | 27 min |
> | Average departure delay | 19.0 min | 18.7 min |
> | Departures delayed 15+ min | 22.9% | 23.8% |
> | Cancelled | 1.2% | 1.4% |
> | Share of delay caused by air traffic control and the national airspace system | 21.3% | 28.2% |
> 
> LAX has slightly longer average taxi-outs. SNA has a slightly longer slow tail and slightly more delayed departures. A larger share of SNA's delay is blamed on air traffic control and the airspace system, which points to airspace or airfield limits rather than the terminal. The tool did not explain why SNA's congestion score is about 10 points higher when the raw measures are this close.
> 
> **Scale and demand (12 months to July 2026):**
> - **Size:** LAX had 36.0M passengers on 253,301 passenger departures. SNA had 5.5M on 50,960.
> - **How full the planes are:** LAX averaged 82.2% of seats filled, peaking at 88.1% in its busiest month. SNA averaged 79.7%, peaking at 82.9%.
> - **Growth:** LAX passengers fell 4.0% year on year. SNA's rose 2.6%.
> - **Overall screening score:** LAX scores 69.5 (ranked #17 nationally). SNA scores 61.9 (#43). Both scores are rated medium confidence.
> 
> **Assumptions and limits**
> - **One month of delay data:** All congestion figures come from July 2025 alone, so they may reflect summer conditions. Both airports carry this warning.
> - **Partial airline coverage:** The delay data only includes large airlines that report on-time figures. That covers 72.7% of LAX flights and 88.8% of SNA flights, so LAX is less completely covered.
> - **What the numbers measure:** Taxi-out time and delays show congestion on the ground and in the departure flow, not terminal capacity. A congested airport doesn't necessarily need a bigger terminal.
> - **Scope:** Passenger flights only, using federal flight and passenger data. Burbank, Long Beach and Ontario were not compared; I can add them if you want the full LA area.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage airport"})`, `route_mix({"airport":"ANC"})`  
**Model calls:** 3 | **Tokens:** in 8, out 928, cache-read 10908 | **Est. cost:** $0.031  
**Grounding:** 32/33 figures traced to tool output; untraced: 1,499

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> At Ted Stevens Anchorage International (ANC), **2.8% of passenger departures are long-haul** (1,100 of 39,532 flights) if long-haul means 3,000+ miles. Those flights carry **6.1% of passengers** (about 169,000). This covers the 12 months from August 2025 to July 2026 [T-100].
> 
> **Why the share is low**
> - Most passenger flights from ANC are short: 49.7% go under 500 miles and another 31.3% go 500–1,499 miles.
> - Most long-haul flights go to the US mainland, mainly Dallas/Fort Worth, which is just over the cutoff at 3,043 miles. Atlanta, Houston, Washington Dulles, Newark and JFK follow. Only 0.2% of departures go 4,000+ miles (Frankfurt, Hong Kong).
> - International flights are just 0.7% of passenger departures.
> 
> **How much the definition matters**
> There's no official definition of long-haul, and the answer depends heavily on where you draw the line:
> 
> | Long-haul threshold | % of departures | % of passengers |
> |---|---|---|
> | 1,500+ mi | 19% | 38% |
> | 2,500+ mi | 9.7% | 20.9% |
> | 3,000+ mi | 2.8% | 6.1% |
> | 3,500+ mi | 0.3% | 0.4% |
> 
> **Assumptions and limits**
> - **Long-haul = 3,000+ statute miles flown nonstop.** The table shows how the share moves under other cutoffs.
> - **Passenger flights only.** ANC has more all-cargo departures (47,717) than passenger ones (39,532), and it handled about 2.85M tons of cargo. Including cargo flights would likely change the answer a lot. I can run the cargo-only or all-flights version if you want it.
> - **Airport choice:** "Anchorage airport" also matched Merrill Field and Elmendorf Air Force Base. I assumed ANC, the commercial airport.
> - **Distances are per flight, not per trip:** they reflect the nonstop leg flown, not passengers' full journeys, so a connecting passenger counts on each leg.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 928, cache-read 6896 | **Est. cost:** $0.030  
**Grounding:** 22/26 figures traced to tool output; untraced: 70,000, 14.1%, 11.7%, 10%

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **SFO shows little sign of unmet passenger demand in the 12 months to July 2026. Planes are fairly full but rarely past the "full" threshold, and seats are growing slightly faster than passengers. The real pressure is airfield congestion, which a bigger terminal may not solve.**
> 
> **What the evidence shows**
> - **Seats are full but not overfull.** Average load factor (the share of seats filled) was 82.1%, higher than 88% of scored US airports [T-100]. But only 1 of 12 months went above 85%: June 2026, at 87.1%.
> - **The seat shortfall is small.** About 70,000 extra seats (70,165) would have kept every month at or below 85%. That is 0.2% of annual seats, and all of it falls in June. This is a proxy, not a count of passengers who were turned away.
> - **Supply is keeping pace with demand.** Passengers grew 0.6% year over year, while seats grew 0.8%.
> - **Some travellers may be going to nearby airports.** Oakland (11 miles away) and San Jose (30 miles away) have much lower load factors (74.4% and 73.5%). Both lost passengers, down 14.1% and 11.7% year over year. This shows there is spare capacity next door. It doesn't prove that SFO is pushing passengers there.
> - **The ground is congested.** On the slowest 10% of departures, taxi-out takes 33 minutes or more, worse than at 90% of scored airports. 23.5% of departures were delayed 15+ minutes [On-Time Performance].
> 
> **Why:** The tool's data includes a note that SFO's closely spaced parallel runways and fog limit arrivals. If that is the binding constraint, a bigger terminal may not let SFO handle more flights. Any limit on SFO's growth is more likely on the airfield than in the terminal.
> 
> **Assumptions and limits**
> - **What "full" means:** Over 85% load factor counts as full. That's a rule of thumb, not a measurement. Full planes also don't prove people were turned away, because airlines fill seats through pricing.
> - **One summer month for delays:** The congestion figures rest on a single month of on-time data (July 2025), so they may reflect one season.
> - **What this data can't show:**
>   - Travellers who never booked or chose another way to travel
>   - Fares and airline revenue per passenger
>   - Denied boarding, waitlists, and gate or slot limits
>   - Demand outside the flight-segment data (T-100)
> - **Scope:** These are passenger and seat figures only. There is no cost or return modelling, and this is a screen, not an investment recommendation.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 345, cache-read 3447 | **Est. cost:** $0.008  
**Grounding:** 0/1 figures traced to tool output; untraced: 100,

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that. Stock picks and airline equities are outside what I cover, and I don't have share price, earnings or market data. Please take that question to a licensed financial adviser or your firm's equities team.
> 
> **What I can do** is screen US airports for terminal expansion or renovation potential, using public data: BTS T-100, On-Time Performance, the FAA Terminal Area Forecast and OurAirports. If Delta is part of your thinking, these could be useful:
> 
> - **Ranking airports** by how strong a case they are for added terminal capacity, nationally or within a region. For example, I could rank the Southeast, where Delta's Atlanta hub sits.
> - **Comparing airports** side by side on size, demand and congestion, for example ATL vs DTW vs MSP.
> - **Demand-gap evidence** at a single airport, such as how full flights are and how often they're near capacity.
> - **Route mix**, such as what share of departures from an airport are long-haul.
> 
> All of these are screening results, not investment advice or return forecasts. Want me to run one of them?
