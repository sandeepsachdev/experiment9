package com.raidonbungelingbay.controller;

import com.raidonbungelingbay.model.HighScore;
import com.raidonbungelingbay.service.HighScoreService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class GameController {

    private final HighScoreService highScoreService;

    public GameController(HighScoreService highScoreService) {
        this.highScoreService = highScoreService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "game", "Raid on Bungeling Bay");
    }

    @GetMapping("/highscores")
    public List<HighScore> highscores() {
        return highScoreService.top();
    }

    @PostMapping("/highscores")
    public List<HighScore> submit(@RequestBody HighScore score) {
        return highScoreService.submit(score);
    }
}
