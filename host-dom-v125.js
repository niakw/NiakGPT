(() => {
  'use strict';
  if(location.hostname!=='chatgpt.com'||window.__NIAKGPT_HOST_DOM_V125__)return;

  const CLASSIC_TURN='article[data-testid^="conversation-turn-"],[data-testid^="conversation-turn-"]';
  const GROUP_TURN='[data-turn-key]';
  const UNIT='[data-content-search-unit-key]';
  const USER_SIGNAL='[data-user-message-bubble],[data-message-author-role="user"],[data-turn="user"]';
  const ASSISTANT_SIGNAL='[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start],[data-markdown-text-style="assistant-message"],[data-message-author-role="assistant"],[data-turn="assistant"]';
  const TURN_SIGNAL_SELECTOR=`${CLASSIC_TURN},${GROUP_TURN},${UNIT},[data-user-message-bubble],[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start],[data-markdown-text-style="assistant-message"],[data-message-author-role]`;
  const COMPOSER_SEL='#prompt-textarea,[data-testid="prompt-textarea"],form[data-chatgpt-composer] [data-composer-markdown][contenteditable="true"][role="textbox"],[data-composer-markdown][contenteditable="true"][role="textbox"],textarea,[contenteditable="true"][role="textbox"]';

  const visible=el=>{
    if(!(el instanceof Element)||!el.isConnected)return false;
    const style=getComputedStyle(el);
    return style.display!=='none'&&style.visibility!=='hidden'&&el.getClientRects().length>0;
  };
  const own=el=>el instanceof Element&&!!el.closest('#ng8-rail,#ng8-panel,#ng8-status,#ng8-coach,#ng8-pins,#ng8-quick,#ng90-control,#ng100-command,#ng119-interruption');

  function roleOf(el){
    if(!(el instanceof Element))return'';
    const direct=String(el.getAttribute('data-message-author-role')||el.getAttribute('data-conversation-role')||el.getAttribute('data-turn')||el.dataset?.ng8Role||'').toLowerCase();
    if(direct==='user'||direct==='assistant')return direct;
    const key=String(el.getAttribute('data-content-search-unit-key')||'').toLowerCase();
    if(/(?:^|:)user(?:$|:)/.test(key))return'user';
    if(/(?:^|:)assistant(?:$|:)/.test(key))return'assistant';
    if(el.matches('[data-user-message-bubble]')||el.querySelector?.('[data-user-message-bubble]'))return'user';
    if(el.matches('[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start],[data-markdown-text-style="assistant-message"]')||
       el.querySelector?.('[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start],[data-markdown-text-style="assistant-message"]'))return'assistant';
    const nested=el.querySelector?.('[data-message-author-role="user"],[data-message-author-role="assistant"]')?.getAttribute('data-message-author-role');
    return nested==='user'||nested==='assistant'?nested:'';
  }

  function pushSurface(out,seen,el,role=''){
    if(!(el instanceof HTMLElement)||!el.isConnected||own(el)||seen.has(el))return;
    const r=role||roleOf(el);if(r!=='user'&&r!=='assistant')return;
    seen.add(el);out.push(el);
  }

  function surfaces(root=document){
    const scope=root instanceof Element||root instanceof Document?root:document;
    const out=[],seen=new Set();
    const candidateRoots=[];
    if(scope instanceof Element)candidateRoots.push(scope);
    for(const el of scope.querySelectorAll?.(`${CLASSIC_TURN},${UNIT},[data-user-message-bubble],[data-markdown-text-style="assistant-message"],[data-message-author-role]`)||[])candidateRoots.push(el);

    for(const el of candidateRoots){
      if(!(el instanceof HTMLElement)||own(el))continue;
      const classic=el.matches?.(CLASSIC_TURN)?el:el.closest?.(CLASSIC_TURN);
      if(classic&&(!scope.contains||scope===classic||scope.contains(classic))){pushSurface(out,seen,classic);continue;}

      const unit=el.matches?.(UNIT)?el:el.closest?.(UNIT);
      if(unit){
        pushSurface(out,seen,unit);
        continue;
      }
      if(el.matches?.('[data-user-message-bubble]')){pushSurface(out,seen,el,'user');continue;}
      if(el.matches?.('[data-markdown-text-style="assistant-message"]')){
        const host=el.parentElement instanceof HTMLElement?el.parentElement:el;
        pushSurface(out,seen,host,'assistant');
        continue;
      }
      if(el.matches?.('[data-message-author-role]'))pushSurface(out,seen,el,String(el.getAttribute('data-message-author-role')||''));
    }

    // Grouped ChatGPT turns can briefly mount their role marker before the content-search unit.
    for(const group of scope.querySelectorAll?.(GROUP_TURN)||[]){
      if(group.querySelector(UNIT))continue;
      const user=group.querySelector('[data-user-message-bubble]');
      if(user)pushSurface(out,seen,user,'user');
      const assistant=group.querySelector('[data-conversation-role="assistant"],[data-chatgpt-agent-turn-start],[data-markdown-text-style="assistant-message"]');
      if(assistant){
        const host=assistant.closest?.('[data-content-search-unit-key]')||assistant.parentElement||assistant;
        pushSurface(out,seen,host,'assistant');
      }
    }

    out.sort((a,b)=>{
      if(a===b)return 0;
      const pos=a.compareDocumentPosition(b);
      return pos&Node.DOCUMENT_POSITION_FOLLOWING?-1:pos&Node.DOCUMENT_POSITION_PRECEDING?1:0;
    });
    return out;
  }

  function closestTurn(node){
    const el=node instanceof Element?node:node?.parentElement;if(!(el instanceof Element))return null;
    const classic=el.closest(CLASSIC_TURN);if(classic)return classic;
    const unit=el.closest(UNIT);if(unit&&roleOf(unit))return unit;
    const user=el.closest('[data-user-message-bubble]');if(user)return user;
    const markdown=el.closest('[data-markdown-text-style="assistant-message"]');
    if(markdown)return markdown.closest(UNIT)||markdown.parentElement||markdown;
    const role=el.closest('[data-message-author-role="user"],[data-message-author-role="assistant"]');if(role)return role;
    return null;
  }

  function composer(scope=document){
    const nodes=[...scope.querySelectorAll(COMPOSER_SEL)].filter(el=>visible(el)&&!own(el));
    return nodes.at(-1)||null;
  }
  function composerForTarget(target){
    if(!(target instanceof Element))return null;
    const direct=target.matches(COMPOSER_SEL)?target:target.closest(COMPOSER_SEL);
    return direct&&visible(direct)&&!own(direct)?direct:null;
  }
  function hasTurns(root=document){return surfaces(root).length>0;}
  function assistantSurfaces(root=document){return surfaces(root).filter(el=>roleOf(el)==='assistant');}
  function userSurfaces(root=document){return surfaces(root).filter(el=>roleOf(el)==='user');}

  window.__NIAKGPT_HOST_DOM_V125__=Object.freeze({
    CLASSIC_TURN,GROUP_TURN,UNIT,TURN_SIGNAL_SELECTOR,COMPOSER_SEL,
    visible,roleOf,surfaces,closestTurn,composer,composerForTarget,hasTurns,assistantSurfaces,userSurfaces
  });
})();