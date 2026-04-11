window.PORTFOLIO_CONTENT = {
  "updates": [
    {
      "id": "2026-03-18-biped",
      "title": "playing around with an arm and a biped and rl",
      "date": "2026-03-18",
      "dateLabel": "2026-03-18",
      "summary": "wanted to test the update page, so though might as well log about the biped, this is more of a random update.",
      "image": "gallery/biped.arm.result.png",
      "html": "<p>i have my exams approaching in a week, and have a lot of stuff to work on, including academics and mainly rl and robotics.</p><p>so i was trying to develop intuition to start working on my design of a humanoid robot. in this process i trained a kinova gen 3 arm (manipulated only 2 degrees of freedom here) to balance at a 45 degree angle using SAC.<br><img src=\"gallery/biped.arm.png\" alt=\"basic arm simulink\"><br><img src=\"gallery/biped.arm.graph.png\" alt=\"sac training graph for arm\"><br><img src=\"gallery/biped.arm.result.png\" alt=\"arm result\"></p><p>at this time i was just using matlab as the platform (my lil g asks me to drop using matlab every day ;-;) but i wanted to use it since i was working on a matlab related project. Now coming to the biped, so i started working on it, i could get it walking by using the rl agent designer (dont have the images on me rn).. but i ditched that, am trying to build it using first principles right now. Oh also i played around rl quite a bit this month... but im dropping most of that stuff, and will walk thorugh rl from start, from first principles.. and design it myself from scratch, i can already see it, me having fun getting my agent work on the atari games.</p>"
    },
    {
      "id": "2026-04-11-updates",
      "title": "Hackathons + Humanoid Simulation + UAV Conference + Breakout",
      "date": "2026-03-18",
      "dateLabel": "2026-03-18",
      "summary": "Qualified for some interesting hackathons, Good progress is being done on training the humanoid robot + Will be attending a UAV conference + Breakout might have to wait a bit.",
      "image": "gallery/clanker.pose.png",
      "html": "<p>The three weeks since the last update have been really different/interesting for me. There are quite a lot of changes in how I approach things and my thinking. Also I think my productivity just increased (in the fields of robotics and AI).<br>For starters, I found a really good place to spend my time (to work on my projects) and have been going there after my classes every day, and as of now this has been pretty good for my journey. (Not for acads, as I am not able to allocate some time for that)</p><p>So First thing, my humanoid robot project is going pretty well, decent progress has been made on the model, all that&#39;s left is to run the v1 training script I have and see if it converges. Will probably do this after this update. (Constrained by matlab/simulink). I have my friends from the industry asking me to switch the platform to Isaac Sim/MuJoCo, but I&#39;ve decided to stick to matlab and take this as a challenge.</p><p><img src=\"gallery/humanoid.circuit.png\" alt=\"Circuit for agent input/output\"><br><img src=\"gallery/clanker.pose.png\" alt=\"clanker pulling crazy pose\"></p><p>Next Breakout, I was working on training an RL agent for Atari Breakout.. Well the problem statement isn&#39;t that hard since we have a lot of solutions already. But what makes this interesting for me is that I&#39;m trying to build this from barebones, with no external help whatsoever. This should let me gain some really good intuition of what the researchers in the frontier did in 2013/14. Though I&#39;m running into some serious time constraints as I&#39;m practically left with no time for this right now.<br>Also I was going through some of my old repositories.. And I have some really interesting projects that are private and that I wish to continue work on.. So for now, I have a lot of projects to work on by the time I&#39;m done with my school.</p><p><img src=\"gallery/atari.breakout.png\" alt=\"Breakout\"><br><img src=\"gallery/atari.breakout.preprocessing.png\" alt=\"Breakout after preprocessing\"></p><p>There is a UAV conference happening in my city next week, I was really excited for that. But I realized how spending my entire week working on stuff really exhausts me on the weekend and I am still considering whether to attend or not.</p><p>Hackathons, I haven&#39;t really been participating in hackathons much since I started working on robots/RL. But fortunately for me, a national level hackathon popped up right in my city, based on RL envs. And I took a shot and participated SOLO (I submitted an initial env I designed), and guess what? I qualified for the 48 hour offline finale. (well the acceptance rates weren&#39;t that bad, they said about 2000 teams were chosen out of 52000).</p><p>That&#39;s about it for this update. I&#39;m sure that I might be missing a lot of stuff, but I&#39;ll try my best to update whatever comes to my mind when writing these updates.</p>"
    }
  ],
  "articles": [],
  "papers": [],
  "gallery": [
    {
      "url": "gallery/humanoid.circuit.png",
      "alt": "humanoid.circuit",
      "caption": "humanoid.circuit",
      "date": "2026-04-11T11:36:07.203Z"
    },
    {
      "url": "gallery/clanker.pose.png",
      "alt": "clanker.pose",
      "caption": "clanker.pose",
      "date": "2026-04-11T11:36:07.202Z"
    },
    {
      "url": "gallery/biped.arm.result.png",
      "alt": "biped.arm.result",
      "caption": "biped.arm.result",
      "date": "2026-04-11T11:36:07.200Z"
    },
    {
      "url": "gallery/biped.arm.png",
      "alt": "biped.arm",
      "caption": "biped.arm",
      "date": "2026-04-11T11:36:07.199Z"
    },
    {
      "url": "gallery/biped.arm.graph.png",
      "alt": "biped.arm.graph",
      "caption": "biped.arm.graph",
      "date": "2026-04-11T11:36:07.198Z"
    },
    {
      "url": "gallery/atari.breakout.preprocessing.png",
      "alt": "atari.breakout.preprocessing",
      "caption": "atari.breakout.preprocessing",
      "date": "2026-04-11T11:36:07.196Z"
    },
    {
      "url": "gallery/atari.breakout.png",
      "alt": "atari.breakout",
      "caption": "atari.breakout",
      "date": "2026-04-11T11:36:07.195Z"
    }
  ]
};
