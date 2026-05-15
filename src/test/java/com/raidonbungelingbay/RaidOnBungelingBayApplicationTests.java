package com.raidonbungelingbay;

import com.raidonbungelingbay.model.HighScore;
import com.raidonbungelingbay.service.HighScoreService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class RaidOnBungelingBayApplicationTests {

    @Test
    void contextLoads() {
    }

    @Test
    void highScoresStartSortedAndAcceptSubmissions() {
        HighScoreService svc = new HighScoreService();
        List<HighScore> top = svc.top();
        assertFalse(top.isEmpty());
        for (int i = 1; i < top.size(); i++) {
            assertTrue(top.get(i - 1).getScore() >= top.get(i).getScore());
        }

        svc.submit(new HighScore("TEST", 9999, 6));
        assertEquals(9999, svc.top().get(0).getScore());
        assertEquals("TEST", svc.top().get(0).getName());
    }

    @Test
    void blankNameIsNormalized() {
        HighScoreService svc = new HighScoreService();
        HighScore s = new HighScore("", 100, 1);
        svc.submit(s);
        assertEquals("???", s.getName());
    }
}
