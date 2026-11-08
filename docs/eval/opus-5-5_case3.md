# Evaluation run

Model: `claude-opus-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 7/7 checks passed. Estimated spend: $0.04.**


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage airport"})`, `route_mix({"airport":"ANC","service":"passenger"})`, `route_mix({"airport":"ANC","service":"all"})`  
**Model calls:** 3 | **Tokens:** in 8, out 1143, cache-read 10900 | **Est. cost:** $0.045  
**Grounding:** 36/36 figures traced to tool output

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS mentions /(all|every) (flights|departures)|including cargo|with cargo|cargo (flights )?(included|too)/i; PASS no tool errors; PASS answer not empty

> Using 3,000+ miles as "long-haul", **2.8% of passenger flights** out of Anchorage (ANC) are long-haul. That covers 1,100 of 39,532 departures and 6.1% of passengers [T-100, 12 months to July 2026]. If you count cargo flights too, the figure jumps to **29.5%**, because ANC is mostly a cargo airport.
> 
> **Why including cargo changes the answer so much**
> - ANC had more all-cargo departures (47,717) than passenger departures (39,532) over the 12 months.
> - 51.6% of all-cargo flights are long-haul, compared with 2.8% of passenger flights. Over all 87,249 flights, that gives 25,743 long-haul departures (29.5%).
> - The long-haul passenger flights go mainly to the US mainland: Dallas/Fort Worth (389 departures), Atlanta (156) and Houston (129). Frankfurt (30) and Hong Kong (14) are small.
> - The long-haul cargo flights go to hubs like Louisville, Miami, Hong Kong, Seoul and Taipei.
> 
> **How the cutoff changes the passenger figure**
> There's no official definition of long-haul, and ANC's answer depends a lot on where you draw the line. Many passenger flights fall just under 3,000 miles:
> 
> | Cutoff | % of passenger flights | % of passengers |
> |---|---|---|
> | 1,500 mi | 19.0% | 38.0% |
> | 2,500 mi | 9.7% | 20.9% |
> | 3,000 mi | 2.8% | 6.1% |
> | 3,500 mi | 0.3% | 0.4% |
> 
> **Assumptions and limits**
> - **Which airport:** "Anchorage" also matched Merrill Field (MRI) and Elmendorf Air Force Base (EDF). I assumed you meant Ted Stevens Anchorage International (ANC), which has far more passenger traffic.
> - **What's counted:** flights that start at ANC, measured by the distance of each nonstop flight. A passenger's full trip isn't counted, so connecting travellers show up on each flight separately.
> - **Time period:** the 12 months to July 2026.
> - **For terminal planning,** the 2.8% passenger figure is probably the one that matters, since cargo flights don't use the passenger terminal.
